# Phase 4: Contact CRUD & Lifecycle - Research

**Researched:** 2026-08-14
**Domain:** React Native / Expo forms + on-device SQLite DAO composition; contact create/edit/lifecycle
**Confidence:** HIGH (data layer + schema verified first-hand on disk; UI patterns established in Phase 3; one genuine architecture decision — navigation — left open)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Inherited & already settled by `06-crud.md` (NOT reopened): create form asks a lean fixed set
(name, category, frequency, last-spoke, phone) + `show_on_new` custom fields; fixed columns render
as a block, custom fields grouped after (never interleaved); defining a custom field is a settings
trip (no inline "+add field"); frequency picker = 7 presets **plus** custom "every N"; rename is a
metadata-only UPDATE; duplicate names warn but don't block; archive→restore→purge is two-stage,
purge shows an impact-summary single-confirm (no name typing); never-contacted and archived are
**separate** homes; create writes contact + (optional) interaction atomically through the
single-writer DAO; backdated create interaction is `source='manual'`, `direction=null`; purge
DELETEs `contact_links` + interactions + events + fuel + custom values + photo file + scheduled
notifications in one transaction; "Rarely responds" is an edit-form toggle, not folded into the
frequency picker.

**Area 1 — Archive & Purge surfaces (owner accepted all):**
- The **Archived contacts** list lives **in Settings** — a distinct, low-traffic row (not a nav tab, not a dashboard filter).
- The Archived entry shows **no count badge** — the screen states its count when opened.
- The profile **"Archive"** action lives in a **low-emphasis overflow (⋯) menu** on the profile header.
- The purge action is labelled **"Delete permanently"** with **destructive/red styling via a theme danger token**, behind the impact-summary confirm.

**Area 2 — Contact links affordance (owner accepted all):**
- Links carry an **optional label**; an unlabelled link shows its host/URL.
- **No label autocomplete in v1.**
- An actionable link opens as a **web URL**: prepend `https://` when no scheme present, call `Linking.openURL` inside try/catch — deliberately sidesteps the Android-11 `<queries>`/`canOpenURL` work. `phone`/`email` keep their own `tel:`/`mailto:` dedicated inputs.
- Links support **add / edit / remove in insertion order** in v1 — the `display_order` column exists but no drag-to-reorder UI ships.

**Area 3 — Create form & copy (owner accepted all):**
- Last-spoke = **tri-state segmented control: `Today · Pick date · Not yet`**, "Not yet" visually distinct. "Not yet" → contacts row with **NULL `last_contact` and no interaction row**; "Today"/"Pick date" → interaction row through the DAO (future dates rejected at entry).
- A capture-created **name-only** contact refines via a prominent **"Add details"** affordance opening the **full edit form**, surfacing **frequency + last-spoke + phone first**. No separate slim mini-form.
- **Duplicate-name warning fires on save** (non-blocking, symmetric across create and edit).
- **"Rarely responds" copy accepted as dossier-specified**: toggle "Rarely responds" / helper "Attempts to reach out won't reset their orbit"; profile "Rarely responds · attempts don't reset the orbit."

### Claude's Discretion (deferred to planning by 06-crud)
- Single-renderer-vs-two-sections form architecture (fixed columns need widgets the 7-type `FieldType` union can't express).
- Edit-form initial-values assembly (JOIN of `contacts` + `contact_custom_values` row + `category_id`→label) via the §14.10 dynamic query layer.
- Splitting the submitted form dict into two writers (fixed `contacts` columns + custom-values row) in one transaction.
- Custom-interval frequency entry: unit affordance (days/weeks/months → `interval_days`) and positive-integer validation.
- Per-type validation-at-entry wiring for the fixed columns (duplicate-name query, partial-date birthday, phone format-or-not, category resolution).
- The `contact_links` table DDL (already shipped — see below) and its inclusion in export/restore.

### Deferred Ideas (OUT OF SCOPE)
- Label autocomplete for links.
- Drag-to-reorder for links (`display_order` column ready; UI deferred).
- A count badge on the Archived entry.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRUD-01 | Create a contact via a lean form (name, category, frequency incl. custom "every N", last-spoke default today + "not yet", phone) + `show_on_new` custom fields; duplicate name warns not blocks | Fixed block + custom block architecture (Architecture Pattern 1); frequency→`interval_days` mapping (Pattern 4); duplicate-name-on-save (Pitfall 6); `defsForCreateForm()` already exists (field-values-dao.ts) |
| CRUD-02 | Last-spoke date writes contact + one interaction row through the single-writer DAO in one transaction (`source='manual'`, `direction=null`); "not yet" writes no interaction; future date rejected | `createContactWithInteraction()` already implements exactly this (recency-dao.ts:278) — but see composed-core requirement for custom values (Pattern 2 / Pitfall 1) |
| CRUD-03 | Edit a contact; edit form always shows every non-quarantined field + dedicated phone/email + links area + "Rarely responds" and reminders-off toggles | New contact-metadata DAO (writes everything EXCEPT `last_contact`); `defsForEditForm()` + `getValuesForContact()` already exist; **rarely_responds change must trigger last_contact recompute** (Pitfall 2) |
| CRUD-04 | Many links per contact in `contact_links` (add/edit/remove, optional label, ordered), each tappable; phone/email stay single tappable columns | `contact_links` table already exists (migration 1); new links-CRUD DAO; `Linking.openURL` with `https://` prepend (Pattern 5) |
| CRUD-05 | Archive from profile (hidden everywhere, restorable); restore + purge live only on a dedicated Archived list (two-stage) | `contacts.archived_at` column exists; archive/restore = metadata UPDATE; every read surface must add `archived_at IS NULL` (Pitfall 4) |
| CRUD-06 | Purge shows impact-summary and, in one transaction, deletes contact + interactions + events + fuel + custom values + contact_links + photo file + scheduled notifications | Purge fan-out DAO (Pattern 3); FK cascade IS live here but explicit deletes required (Pitfall 3); photo/notification cleanup are Phase-5/11 extension points (Open Question 3) |
</phase_requirements>

## Summary

Phase 4 is a **UI + DAO-composition phase, not a schema phase.** Verified first-hand: migration 1
(`src/db/migrations/001-initial.ts`) already ships every column and both tables this phase needs —
`contacts` has `name, category_id, interval_days, social_battery, birthday, phone, email, photo,
last_contact, archived_at, snooze_until, rarely_responds, reminders_off`, and `contact_links`
already exists with `url, label` (nullable), `display_order`, and the standard `uid`/timestamps.
**No migration, no ALTER TABLE, no new column is needed or permitted.** The data foundation is done;
Phase 4 writes the DAOs that read/write it and the screens that drive them.

The single most consequential technical finding: **the existing DAOs cannot be naively composed into
one atomic transaction.** `createContactWithInteraction()` (recency-dao.ts) and `upsertValue()`
(field-values-dao.ts) each wrap their body in `inWriteTransaction`, and the shared mutex
(`src/db/mutex.ts`) is **non-reentrant** — calling one inside the other is a permanent hang (this is
the documented HIGH-1 sweep-deadlock lesson, transaction.ts header). To write contact + first
interaction + N `show_on_new` custom values atomically (CRUD-01/02, which the locked decisions
require to be one transaction), the plan must follow the established **core/wrapper pattern**: extract
non-mutexed transaction-body cores and compose them inside ONE outer `inWriteTransaction`. This is the
central architectural task of the phase and must be planned explicitly, not discovered mid-execution.

Second finding, easy to miss and data-corrupting if missed: **editing `rarely_responds` must recompute
`last_contact`.** The single-writer recompute (recency-dao.ts) filters `MAX(occurred_at)` to connected
rows only when `rarely_responds = 1`. A contact-metadata edit that flips this flag but does not route a
recompute through the single writer leaves `last_contact` stale and wrong. The new contact-metadata
edit DAO writes every `contacts` column EXCEPT `last_contact` (preserving the single-writer invariant),
but a `rarely_responds` change is the one edit that must additionally trigger a recompute.

**Primary recommendation:** Build the phase as vertical slices over four new DAO modules
(contact-metadata write, contact-links CRUD, contact read/assembly, purge fan-out) plus a composed
atomic-create core, all reusing `inWriteTransaction` via the core/wrapper pattern; reuse the Phase-3
field-widget + `FieldValueInput` dispatcher verbatim for the custom-field block; add the two native
pickers via `npx expo install`; add the `danger` theme token; and settle the navigation-shell approach
(the one open owner-facing decision) before planning screen structure.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Contact create (contacts + interaction + custom values) | Data layer (composed DAO) | UI form | Atomicity is a transaction concern; UI only collects the dict |
| Last-spoke → interaction write | Data layer (single-writer recency DAO) | — | `last_contact` has exactly one writer, project-wide (DATA-04) |
| Contact metadata edit | Data layer (new contact-metadata DAO) | UI form | Writes every `contacts` column EXCEPT `last_contact`; must recompute on `rarely_responds` flip |
| Contact links CRUD | Data layer (new links DAO) | UI links editor | Child-table rows; insertion-order via `display_order` |
| Custom-field values on the form | Data layer (`upsertValue` / `getValuesForContact`) | UI (`FieldValueInput` dispatcher) | Already built in Phase 3 — reuse, do not rebuild |
| Archive / restore | Data layer (metadata UPDATE of `archived_at`) | UI overflow menu / Archived list | Reversible flag flip; read surfaces filter `archived_at IS NULL` |
| Purge fan-out | Data layer (purge DAO, one transaction) | UI impact-summary confirm | Blast radius spans 5 child tables + non-DB targets |
| Native date / dropdown pickers | Browser/Client (RN native module) | — | Platform widgets; no JS shim needed |
| Link opening (`https://`) | Browser/Client (`Linking`) | — | OS handoff via RN core `Linking` |
| Navigation between screens | Client (nav shell — TBD) | — | **Open decision** — see Open Question 1 |

## Standard Stack

### Core (already installed — reuse)
| Module | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| `expo-sqlite` | ~57.0.1 | On-device DB | The data layer; all DAOs run over its `SqlExecutor` adapter (database.ts) |
| `react` / `react-native` | 19.2.3 / 0.86.2 | UI | The app framework |
| `zustand` | ^5.0.15 | State stores | Convention for `src/stores/` (theme-store.ts today) |
| `react-native-safe-area-context` | ~5.7.0 | Safe-area insets | Already present; a react-navigation peer dep if that route is chosen |

### Supporting (NEW — add via `npx expo install`, not `npm install`)
| Package | Version (SDK 57) | Purpose | When to Use |
|---------|------------------|---------|-------------|
| `@react-native-community/datetimepicker` | 9.1.0 `[VERIFIED: npm registry]` | Native Android date picker | Last-spoke "Pick date"; birthday. No month/day-only mode → year-optional is app logic |
| `@react-native-picker/picker` | 2.11.4 `[VERIFIED: npm registry]` | Native select | Category (over the live `categories` table) and social-battery dropdowns |

`Linking` (link opening), `Modal`, `FlatList`, `Switch`, `TextInput`, `Pressable` are **React Native
core** — no dependency. `@expo/ui` (57.0.11) is an *alternative* to `@react-native-picker/picker` but
is newer/less-proven; prefer the community picker unless the owner wants `@expo/ui` — `[ASSUMED]`.

**Installation:**
```bash
npx expo install @react-native-community/datetimepicker @react-native-picker/picker
```
> Use `npx expo install` (not `npm install`) so versions are pinned to the SDK-57 compatibility table.
> Both are native modules → they require a fresh dev-client / release build through the desktop
> pipeline (`docs/runbooks/desktop-build-pipeline.md`); they will NOT work by JS reload alone.

### Navigation (DECISION REQUIRED — see Open Question 1)
| Option | Packages | Tradeoff |
|--------|----------|----------|
| **A. `@react-navigation/native` + `native-stack`** (recommended) | `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens` (+ existing safe-area-context) | RN standard; native back-gesture + header. Adds a native module (rebuild). Incremental — wraps existing `App.tsx` |
| **B. Hand-rolled route state** (status quo) | none | Zero deps, matches Phase-3 `HomeScreen` `useState<Route>` pattern. Gets unwieldy across the 6-screen tree (Home→Profile→Edit, Settings→Archived); no native back |
| C. `expo-router` | `expo-router` | Expo's current default (file-based), but a larger restructure of `index.ts`/`app/` — disproportionate for this app's size |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@react-native-picker/picker` | Phase-3 `DropdownFieldWidget` (Pressable+Modal+FlatList) | Zero-dep, already built. Viable fallback if the owner wants no new native module — but 06-crud F3 explicitly calls for the *native* picker for category/battery. Keep it as the documented fallback |
| `@react-native-community/datetimepicker` | Phase-3 `DateFieldWidget` (`YYYY-MM-DD` TextInput) | Zero-dep, already built. But typing a date for last-spoke/birthday is high-friction; the native picker is the 06-crud F3 recommendation |

## Package Legitimacy Audit

| Package | Registry | Age | Source Repo | postinstall | Verdict | Disposition |
|---------|----------|-----|-------------|-------------|---------|-------------|
| `@react-native-community/datetimepicker` | npm | mature (react-native-datetimepicker org) | github.com/react-native-datetimepicker/datetimepicker | none | OK | Approved — first-party RN community |
| `@react-native-picker/picker` | npm | mature (react-native-picker org) | github.com/react-native-picker/picker | none | OK | Approved — first-party RN community |
| `@expo/ui` | npm | Expo-official | expo/expo monorepo | n/a | OK (optional) | Only if owner prefers over community picker |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none. Both new packages are official React Native Community
modules, name-verified on the correct (npm) registry, with public source repos and no postinstall
scripts. Versions confirmed against the registry as current SDK-57-compatible releases. They were also
independently identified in the dossier's `platform-form-widgets.md` workpaper from official Expo docs.

## Architecture Patterns

### System Architecture Diagram

```
                          CREATE / EDIT CONTACT FORM (UI)
   ┌───────────────────────────────────────────────────────────────────────┐
   │  Fixed block (hand-built widgets):                                      │
   │    Name(required) → Category(native picker) → Frequency(presets+"every N")│
   │    → Last-spoke(tri-state) → Phone   [edit adds: email, birthday,       │
   │    social-battery, links editor, Rarely-responds, reminders-off]        │
   │  Custom block (REUSE FieldValueInput dispatcher):                       │
   │    defsForCreateForm() on create / defsForEditForm() on edit            │
   └───────────────┬───────────────────────────────────────────────────────┘
                   │ one submitted dict  { fixed cols... , custom col_name→value... }
                   ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │  SPLIT INTO WRITERS — inside ONE inWriteTransaction (core/wrapper)      │
   │                                                                         │
   │  CREATE:  contacts INSERT ─┐                                            │
   │           interaction INSERT (if Today/Pick date) ─┤ recomputeLastContact│
   │           upsertValue × N (show_on_new custom vals) ┘  (all one txn)    │
   │                                                                         │
   │  EDIT:    contacts UPDATE (every col EXCEPT last_contact)               │
   │           upsertValue × N (edited custom vals)                         │
   │           IF rarely_responds changed → recomputeLastContact  ◄── Pitfall 2│
   └───────────────┬───────────────────────────────────────────────────────┘
                   ▼
         SQLite (expo-sqlite, single shared connection, mutex-serialized)
                   ▲
   ┌───────────────┴───────────────────────────────────────────────────────┐
   │  READ / ASSEMBLY:  contacts row + getValuesForContact(defs)            │
   │                    + listLinks(contactId) + category_id→label JOIN      │
   │                    → edit-form initial values                          │
   └───────────────────────────────────────────────────────────────────────┘

   LIFECYCLE:  archive/restore = UPDATE contacts.archived_at   (metadata)
               purge = ONE txn: DELETE interactions, events, fuel,
                       contact_custom_values, contact_links, contacts
                       (+ photo file [P5], scheduled notifications [P11])
```

### Component Responsibilities
| File (new unless noted) | Responsibility |
|------|----------------|
| `src/db/contacts-dao.ts` (new) | `updateContactMetadata()` — UPDATE every `contacts` col except `last_contact`; `archiveContact()`/`restoreContact()`; `listArchived()`; the atomic **composed create** core |
| `src/db/contact-links-dao.ts` (new) | `listLinks()`, `addLink()`, `updateLink()`, `removeLink()` — child-table CRUD, `display_order` = append index |
| `src/db/contact-read.ts` (new) | Edit-form initial-values assembly: `contacts` JOIN `categories` + `getValuesForContact()` + `listLinks()` |
| `src/db/purge-dao.ts` (new) | `computeImpact()` (COUNTs for the summary) + `purgeContact()` (one-txn fan-out) |
| `src/db/recency-dao.ts` (MODIFY) | Extract a non-mutexed create core + export a `recomputeLastContact` entry point for the rarely_responds edit path |
| `src/db/field-values-dao.ts` (reuse; maybe extract core) | `upsertValue` core for composition; `getValuesForContact`, `defsForCreateForm`, `defsForEditForm` reuse as-is |
| `src/screens/*` (new) | CreateContactScreen, EditContactScreen, ContactProfileScreen (scaffold), SettingsScreen, ArchivedContactsScreen |
| `src/components/*` (new) | FrequencyPicker, TriStateLastSpoke, LinksEditor, OverflowMenu, native Category/Battery pickers |
| `src/theme/theme-presets.ts` + `theme-types.ts` (MODIFY) | Add `danger` token to `ThemePalette` + `space-dark.dark` |

### Pattern 1 — Two-section form (fixed block + reused custom block)
**What:** Do NOT unify fixed columns and custom fields under one schema renderer. The 7-type
`FieldType` union cannot express category-over-a-live-table, `interval_days` frequency, tri-state
last-spoke, or partial-date birthday (06-crud F4, Deferred-to-planning). Render the fixed columns as
hand-built widgets in a fixed order, then render the custom block by mapping
`defsForCreateForm(defs)` (create) or `defsForEditForm(defs)` (edit) through the existing
`<FieldValueInput>` dispatcher. Never interleave (locked decision).
**When:** both create and edit forms.
**Example:** the custom block is exactly the Phase-3 pattern already in `FieldDefForm`'s preview —
`<FieldValueInput field={def} value={values[def.col_name]} onChange={...} />`.

### Pattern 2 — Compose transactional DAOs via non-mutexed cores (CRITICAL)
**What:** The shared mutex is non-reentrant (transaction.ts). To do multiple writes atomically, extract
each op's transaction body as a plain `async (exec) => {...}` core that assumes BEGIN is open, then call
all cores inside ONE `inWriteTransaction`. Precedent: `deleteOrQuarantineField` (field-ddl.ts) and the
core/wrapper note in transaction.ts.
**When:** atomic create (contacts + interaction + custom values); atomic edit (contacts + custom
values [+ recompute]).
```typescript
// Source: pattern from src/db/transaction.ts header + field-ddl.ts precedent
// Extract cores (no mutex, assume BEGIN open):
async function insertContactCore(exec, input) { /* INSERT contacts ... returns id */ }
async function insertInteractionCore(exec, contactId, now, i) { /* INSERT interactions */ }
async function recomputeCore(exec, contactId, now) { /* the correlated UPDATE */ }
async function upsertValueCore(exec, contactId, uid, col, value, now) { /* guarded UPSERT */ }

// Compose ONCE:
export function createContactFull(exec, input) {
  // validate interval_days > 0 BEFORE opening any txn (recency-dao precedent)
  return inWriteTransaction(exec, async () => {
    const contactId = await insertContactCore(exec, input);
    if (input.firstInteraction) {
      await insertInteractionCore(exec, contactId, input.now, input.firstInteraction);
      await recomputeCore(exec, contactId, input.now);
    }
    for (const cv of input.customValues) {
      await upsertValueCore(exec, contactId, input.rowUid, cv.col, cv.value, input.now);
    }
    return { contactId };
  });
}
```
**Anti-pattern:** calling `createContactWithInteraction()` then `upsertValue()` from the screen —
two separate transactions (not atomic, and the second would deadlock if nested). Refactor
recency-dao/field-values-dao to expose cores; keep their existing wrapped exports for standalone callers.

### Pattern 3 — Purge fan-out in one transaction, explicit deletes
**What:** Delete every child explicitly, then the contact, inside one `inWriteTransaction`. Do NOT rely
on `ON DELETE CASCADE` (see Pitfall 3). Compute the impact COUNTs FIRST (same or prior read) for the
summary; omit any zero-count line (UI-SPEC).
```sql
-- one transaction, contactId bound:
DELETE FROM interactions          WHERE contact_id = ?;
DELETE FROM events                WHERE contact_id = ?;
DELETE FROM fuel                  WHERE contact_id = ?;   -- always 0 rows in Phase 4 (Phase-7 feature)
DELETE FROM contact_custom_values WHERE contact_id = ?;
DELETE FROM contact_links         WHERE contact_id = ?;
-- consider: DELETE FROM field_history WHERE contact_id = ?;  (Open Question 2)
DELETE FROM contacts              WHERE id = ?;
```
Non-DB targets (photo file, scheduled notifications) are Phase-5/11 subsystems that do not exist yet —
see Open Question 3 for how to keep CRUD-06 honest without fabricating deletes.

### Pattern 4 — Frequency: presets + custom "every N" → `interval_days`
**What:** 7 named presets map to `FREQUENCY_DAYS` (src/types.ts): Daily=1, Weekly=7, Bi-Weekly=14,
Monthly=30, Quarterly=90, Bi-Annually=182, Yearly=365. "Custom…" reveals an integer input + unit
affordance (days/weeks/months) that computes `interval_days` (×1/×7/×30). Validate a **positive
integer** (`Number.isInteger && > 0`) — `createContactWithInteraction` already rejects non-positive
intervals at the write chokepoint (recency-dao.ts:289), but validate at entry too for a clean message
("Enter a whole number greater than 0.", UI-SPEC).

### Pattern 5 — Actionable links
**What:** Open a link as a web URL: prepend `https://` when no scheme, `await Linking.openURL(url)` in
try/catch; on throw show "Couldn't open this link." (UI-SPEC). `Linking` is RN core. Deliberately
skip `canOpenURL` (Android-11 `<queries>` manifest work stays unneeded — locked decision).
`phone`/`email` use `tel:`/`mailto:` from their dedicated inputs, not the links list.

### Anti-Patterns to Avoid
- **Unifying fixed + custom fields under one renderer** — fixed columns need widgets the `FieldType` union can't express (06-crud F4).
- **Nesting `inWriteTransaction`** — permanent hang (the HIGH-1 lesson). Compose cores instead.
- **A second writer of `last_contact`** — only recency-dao writes it. The metadata edit DAO writes every OTHER column.
- **Interpolating a custom col_name anywhere but `sortExpr()` / the guarded `upsertValue`/`getValuesForContact` sites** — TEXT-storage leaks only through `sortExpr()` (FLD-06).
- **`toISOString().split('T')[0]`** — use `formatLocalDate()` / `localDateTime()` / `date('now','localtime')`.
- **Hardcoding any colour**, including the new red — it must be the `danger` token; `check:colors` fails the build otherwise.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic multi-table write | A new BEGIN/COMMIT block | `inWriteTransaction` + extracted cores | One place owns the mutex + rollback + no-nesting rule (transaction.ts) |
| `last_contact` after any interaction/flag change | Any UPDATE of `last_contact` | The single-writer recompute (recency-dao) | Project-wide DATA-04 invariant; connected-only filter for rarely_responds |
| Custom-field value widgets | New inputs per type | `FieldValueInput` dispatcher + `field-widgets/*` | Built + tested in Phase 3; TEXT-storage contract already honored |
| Custom-field visibility on each surface | Re-deriving show/hide | `defsForCreateForm` / `defsForEditForm` / `visibleDefsForProfile` | Pure selectors already shipped (field-values-dao.ts) |
| Safe custom column identifier | Any string interpolation | `isSafeColName` guard (already inside the DAOs) | T-03-01 injection boundary |
| Local date strings | Manual date math | `formatLocalDate()` / `localDateTime()` | UTC off-by-one already fixed once in the plugin |
| Native date / select input | A custom modal date entry | `@react-native-community/datetimepicker` / `@react-native-picker/picker` | Platform-native UX; 06-crud F3 |
| Frequency-days mapping | New constants | `FREQUENCY_DAYS` (src/types.ts) | Ported and tested (FND-02) |

**Key insight:** roughly 70% of this phase's data logic already exists — the risk is in *composing*
tested single-purpose DAOs without violating the non-reentrant-mutex and single-writer invariants, not
in writing new SQL.

## Common Pitfalls

### Pitfall 1: Deadlock by nesting transactional DAOs
**What goes wrong:** Screen calls `createContactWithInteraction()` and then `upsertValue()` (or one
inside the other) to save custom values — the second acquisition queues behind the first's settlement: permanent hang.
**Why:** `withMutex` is a single non-reentrant promise chain (mutex.ts); this is the exact HIGH-1
sweep-deadlock the codebase already fixed once.
**How to avoid:** Pattern 2 — extract non-mutexed cores, compose inside ONE `inWriteTransaction`.
**Warning signs:** a save that spins forever with no error; a test that times out rather than fails.

### Pitfall 2: Editing `rarely_responds` without recomputing `last_contact`
**What goes wrong:** Flipping "Rarely responds" changes which interaction rows count toward recency
(connected-only when on), but a plain metadata UPDATE leaves `last_contact` at its old value → status
math is silently wrong.
**Why:** `recomputeLastContact` filters `contacts.rarely_responds = 0 OR i.connected = 1`; the stored
`last_contact` was computed under the OLD flag.
**How to avoid:** when the edit changes `rarely_responds`, route a recompute through the single writer
(export a `recomputeLastContact(contactId, now)` entry point) inside the same edit transaction. LOG-04
depends on this filtered MAX being correct.
**Warning signs:** a rarely-responds contact whose orbit doesn't shift after the toggle; a test that
sets the flag but asserts nothing about `last_contact`.

### Pitfall 3: Assuming FK cascade covers purge (or assuming it doesn't fire)
**What goes wrong:** Two opposite mistakes. (a) Relying on `ON DELETE CASCADE` and skipping explicit
deletes — CRUD-06 requires explicit deletes, the impact summary needs the counts, and `field_history`
has NO foreign key so it never cascades. (b) Believing cascade "doesn't fire in a transaction" (a
dossier note about `withExclusiveTransactionAsync`) — this codebase sets `PRAGMA foreign_keys = ON`
(database.ts) and uses hand-rolled BEGIN, so cascade **does** fire here.
**Why:** the child tables (`interactions`, `events`, `fuel`, `contact_custom_values`, `contact_links`)
all declare `ON DELETE CASCADE` to `contacts`; `field_history` does not reference `contacts` at all.
**How to avoid:** delete every child explicitly THEN the contact, one transaction (Pattern 3). Explicit
deletes are idempotent regardless of cascade order, so this is safe belt-and-suspenders and keeps the
blast radius auditable.
**Warning signs:** a purge that "works" but leaves `field_history` rows; a summary count that doesn't
match what's deleted.

### Pitfall 4: A read surface that forgets `archived_at IS NULL`
**What goes wrong:** An archived contact reappears on the dashboard / never-contacted / pickers.
**Why:** archive is a soft flag (`archived_at` set), not a delete. Every read that lists live contacts
must filter it. `STATUS_SCAN` (queries.ts) already does; new reads in this phase must too, and the
Archived list does the inverse (`archived_at IS NOT NULL`).
**How to avoid:** make "live contact" a shared predicate; the Archived list is its only complement.
**Warning signs:** an archived person showing in a category picker or count.

### Pitfall 5: Native modules not rebuilt
**What goes wrong:** `datetimepicker`/`picker` throw "native module not found" after a JS-only reload.
**Why:** they ship native code; Expo Go / a stale dev client / a JS refresh won't include them.
**How to avoid:** after `npx expo install`, rebuild through the desktop pipeline
(`docs/runbooks/desktop-build-pipeline.md`) before on-device verification.
**Warning signs:** red-screen on first render of the picker.

### Pitfall 6: Duplicate-name check that queries per keystroke or blocks save
**What goes wrong:** Querying on every keystroke (perf) or hard-blocking a legitimate duplicate.
**Why:** the decision is a non-blocking warn ON SAVE, symmetric create/edit ("You already have a
Chris — save anyway?").
**How to avoid:** one `SELECT ... WHERE name = ? AND archived_at IS NULL` at submit (exclude self on
edit via `id != ?`); on hit show the two-action alert, proceed on "Save anyway".
**Warning signs:** a debounce timer on the name field; a disabled submit on duplicate.

### Pitfall 7: Birthday storage convention drift
**What goes wrong:** Storing year-unknown birthdays inconsistently breaks the later single birthday
parser (DASH-05/NOTIF-04).
**Why:** the native picker has no month/day-only mode (06-crud F3); year-optional is app logic.
**How to avoid:** adopt the plugin's established convention (verified in `~/projects/Orbit/src/types.ts:84`):
store `MM-DD` when year unknown, `YYYY-MM-DD` when known; distinguish by string length. A "Year
unknown" toggle beside the picker drives which is written.
**Warning signs:** a sentinel year like `0000` or `1900` leaking into UI.

## Code Examples

### Contact-metadata edit (writes every column EXCEPT last_contact)
```typescript
// Source: pattern derived from recency-dao.ts + field-defs-dao.ts (assertOneChange, inWriteTransaction)
// NOTE: does NOT touch last_contact — that is recency-dao's sole domain. If rarelyResponds
// changed, the caller ALSO routes a recompute (Pitfall 2), composed via cores in one txn.
export function updateContactMetadataCore(exec, input) {
  return exec.runAsync(
    `UPDATE contacts SET
       name=?, category_id=?, interval_days=?, social_battery=?, birthday=?,
       phone=?, email=?, rarely_responds=?, reminders_off=?, modified_at=?
     WHERE id=?`,
    [input.name, input.categoryId ?? null, input.intervalDays, input.socialBattery ?? null,
     input.birthday ?? null, input.phone ?? null, input.email ?? null,
     input.rarelyResponds, input.remindersOff, input.now, input.id],
  );
}
```

### Contact-links CRUD (insertion order via display_order)
```typescript
// Source: pattern from field-defs-dao.ts (uid + timestamps + assertOneChange)
export function addLinkCore(exec, { uid, contactId, url, label, order, now }) {
  return exec.runAsync(
    `INSERT INTO contact_links (uid, contact_id, url, label, display_order, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uid, contactId, url, label ?? null, order, now, now],   // order = current max+1 (append)
  );
}
// listLinks: SELECT ... WHERE contact_id=? ORDER BY display_order
```

### Archive / restore (soft flag)
```typescript
// archive: UPDATE contacts SET archived_at=?, modified_at=? WHERE id=?
// restore: UPDATE contacts SET archived_at=NULL, modified_at=? WHERE id=?
//   (04-log notes restore may also write an events row — confirm scope; events table exists)
```

### Native date picker (year-optional birthday)
```typescript
// Source: @react-native-community/datetimepicker docs (CITED)
import DateTimePicker from '@react-native-community/datetimepicker';
// show imperatively on Android; onChange gives a Date. Format via formatLocalDate(date).
// "Year unknown" toggle → store MM-DD (slice the formatLocalDate output) instead of YYYY-MM-DD.
// Last-spoke: reject a future date at onChange before writing (recency future-occurred_at rule).
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Plugin `FormRenderer` — one flat dict → one Obsidian frontmatter write | Two storage destinations (fixed `contacts` cols + `contact_custom_values` row), split in one txn | This phase | Structural port only; the markdown plumbing dies (06-crud F4) |
| Plugin: no contact delete/archive anywhere | Full archive/restore/purge lifecycle | This phase | All lifecycle surfaces are net-new; nothing to port (06-crud F2) |
| Plugin `<select>` raw-value escape hatch | Dropped — category is a FK to a live table | This phase | No drifted value to preserve (06-crud Decision-without-you 7) |
| Phase-3 `DateFieldWidget` (typed `YYYY-MM-DD`) | Native `datetimepicker` for last-spoke/birthday | This phase | Lower friction; native module rebuild required |

**Deprecated/outdated:** none pulled forward. The plugin's DOM primitives and Obsidian coupling are
abandoned per HANDOFF §4 — port structure, not code.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@react-navigation/native` + native-stack is the right navigation choice | Standard Stack / OQ1 | Adds a native module + rebuild; owner may prefer the zero-dep hand-rolled route pattern. **Owner/planner must confirm before screen structure is planned** |
| A2 | Birthday year-unknown stored as `MM-DD`, known as `YYYY-MM-DD` | Pitfall 7 | Verified against the plugin's own convention (types.ts:84) — LOW risk, but the later single birthday parser inherits it |
| A3 | Restore writing an `events` row is in-scope for this phase | Code Examples | 04-log exported it as a restore data contract; if deferred, restore is a pure `archived_at=NULL` flip |
| A4 | Photo-file + scheduled-notification cleanup are deferred to Phases 5/11 | OQ3 | If the planner instead stubs them now, CRUD-06's "in one transaction" wording needs care (file/OS ops aren't DB rows) |
| A5 | `@expo/ui` is NOT used; community picker is preferred | Standard Stack | Owner may prefer `@expo/ui`; either is legitimate |

## Open Questions

1. **Navigation shell — which approach?** (Highest-impact decision; shapes every screen task.)
   - What we know: the UI-SPEC commits to "Phase 4 introduces the real navigation shell"; no nav
     library is installed; the app currently uses a hand-rolled `useState<Route>` toggle (HomeScreen).
   - What's unclear: library vs. hand-rolled. Six screens across two levels (Home→Profile→Edit;
     Settings→{Custom Fields, Reachability, Archived}→Archived list) push the hand-rolled pattern toward
     unwieldy, but a nav library is a native-module dependency touching build/risk posture.
   - Recommendation: **`@react-navigation/native` + `@react-navigation/native-stack`** (Option A) —
     RN-standard, incremental over `App.tsx`, reuses the installed safe-area-context. Confirm with the
     owner before planning screens (adds a dependency → arguably risk-posture, the owner's bucket).

2. **Purge and `field_history`.** `field_history` has no FK to `contacts`, so a purge leaves that
   contact's type-change/drop snapshots orphaned. CRUD-06's list doesn't name it and BKP-01 excludes it
   from export. Recommendation: add `DELETE FROM field_history WHERE contact_id = ?` to the fan-out for
   cleanliness (harmless; keeps no orphaned rows) — confirm the planner agrees it's in-scope.

3. **Photo file + scheduled notifications in the purge.** Neither subsystem exists yet (photos = Phase
   5, notifications = Phase 11), and their deps (`expo-file-system`, `expo-notifications`) aren't
   installed. A Phase-4 purge cannot delete a photo file that can never have been set, nor cancel a
   notification that was never scheduled. Recommendation: implement the DB fan-out now; document
   photo-file and notification cleanup as **required extension points** that Phases 5 and 11 wire into
   `purgeContact()` when they add those subsystems (mirrors how DATA-06's launch-sweep registry is
   filled incrementally). Keeps CRUD-06 honest for what exists.

4. **Edit-save atomicity.** Create is explicitly one-transaction (locked). For edit (contacts metadata
   + N custom values [+ maybe recompute]), the CustomFieldsScreen precedent runs each DAO op in its own
   transaction sequentially. Recommendation: make edit atomic too via the composed-core pattern —
   partial failure across contacts + custom values would leave an inconsistent contact. Low cost given
   the cores already exist for create.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| expo-sqlite | all DAOs | ✓ | ~57.0.1 | — |
| `@react-native-community/datetimepicker` | last-spoke / birthday pickers | ✗ (not installed) | 9.1.0 (target) | Phase-3 `DateFieldWidget` (`YYYY-MM-DD` TextInput) |
| `@react-native-picker/picker` | category / battery dropdowns | ✗ (not installed) | 2.11.4 (target) | Phase-3 `DropdownFieldWidget` (Pressable+Modal+FlatList) |
| Navigation library | multi-screen shell | ✗ (not installed) | — (OQ1) | Hand-rolled `useState<Route>` (status quo) |
| `Linking` (RN core) | actionable links | ✓ | RN 0.86 | — |
| Desktop build pipeline (native rebuild) | the two native pickers | ✓ (proven) | — | none — required for native modules |

**Missing dependencies with no fallback:** none absolute — every new package has a viable zero-dep
Phase-3 fallback already in the repo, so the phase can ship even if the owner declines new native deps.
**Missing dependencies with fallback:** the two pickers (fall back to Phase-3 widgets); navigation
(falls back to hand-rolled route state).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 (node env) |
| Config file | none — `npm test` = `vitest run`; DB tests use `src/db/__testkit__/node-sqlite.ts` adapter |
| Quick run command | `npx vitest run src/db/<module>.test.ts` |
| Full suite command | `npm test` |
| Colour gate | `npm run check:colors` (fails on any hex outside theme-presets.ts) |

**Test reality:** DAO/logic is node-tested against a `node:sqlite` in-memory DB seeded by
`migration001` (the pattern in every `src/db/*.test.ts`). UI components are **not** unit-tested — they
are verified on the Pixel via `uiautomator dump` against `testID`/`accessibilityLabel` (the HomeScreen
pattern). Plan test tasks accordingly: logic → vitest; screens → device UAT.

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | Exists? |
|-----|----------|-----------|-------------------|---------|
| CRUD-01/02 | atomic create (contact+interaction+custom vals); "not yet"→NULL, no interaction; future rejected; interval>0 | unit | `npx vitest run src/db/contacts-dao.test.ts` | ❌ Wave 0 |
| CRUD-02 | last-spoke writes interaction `source='manual' direction=null` through single writer | unit | (same) | ❌ Wave 0 |
| CRUD-03 | metadata edit writes all cols except last_contact; rarely_responds flip recomputes | unit | `npx vitest run src/db/contacts-dao.test.ts` | ❌ Wave 0 |
| CRUD-04 | links add/edit/remove ordered; list by display_order | unit | `npx vitest run src/db/contact-links-dao.test.ts` | ❌ Wave 0 |
| CRUD-05 | archive/restore flips archived_at; live reads exclude, Archived list includes | unit | `npx vitest run src/db/contacts-dao.test.ts` | ❌ Wave 0 |
| CRUD-06 | purge deletes all 5 child tables + contact in one txn; impact counts correct | unit | `npx vitest run src/db/purge-dao.test.ts` | ❌ Wave 0 |
| CRUD-01/03 | duplicate-name detection (create + edit, exclude self, exclude archived) | unit | `npx vitest run src/db/contact-read.test.ts` | ❌ Wave 0 |
| all screens | forms render, pickers open, warnings fire, purge confirm | manual/device | `uiautomator dump` on Pixel | manual |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched module>.test.ts` + `npm run check:colors`.
- **Per wave merge:** `npm test`.
- **Phase gate:** `npm test` green + on-device UAT before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/db/contacts-dao.test.ts` — create/edit/archive/restore (CRUD-01/02/03/05)
- [ ] `src/db/contact-links-dao.test.ts` — links CRUD ordering (CRUD-04)
- [ ] `src/db/purge-dao.test.ts` — fan-out + impact counts (CRUD-06)
- [ ] `src/db/contact-read.test.ts` — edit-form assembly + duplicate-name query
- [ ] Composed-core regression: a test that create+customValues completes without hanging (guards Pitfall 1)
- [ ] Framework install: none needed — vitest + node-sqlite testkit already present

## Security Domain

`security_enforcement: true`, ASVS level 1. Local-first app, no network on any read/write path
introduced here (link opening hands off to the OS browser; no data leaves the device).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Custom col_name via `isSafeColName` (already enforced in DAOs); interval positive-integer guard; every runtime value `?`-bound |
| V5 Injection | yes | The ONLY interpolated identifier is a guarded custom col_name (`sortExpr`/`upsertValue`/`getValuesForContact`); contact metadata + links are all `?`-bound — no new interpolation site |
| V6 Cryptography | no | No secrets handled this phase (AI keys are Phase 14, expo-secure-store) |
| V2 Auth / V3 Session / V4 Access Control | no | No auth/session/multi-user; single-user on-device |
| V7 Error handling | yes | DAO ops assert `changes === 1` → loud rollback (field-defs-dao precedent); screen-level try/catch with the UI-SPEC failure copy |

### Known Threat Patterns for RN + expo-sqlite
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via custom field name | Tampering | `isSafeColName` construct-not-escape guard (already in DAOs); no new interpolation |
| SQL injection via contact fields (name, url, label, phone) | Tampering | Parameterized `?` binds everywhere — never interpolate user text |
| Data-corruption via mis-scoped mutation | Tampering | `assertOneChange` + both-key scoping (recency-dao precedent); single-writer `last_contact` |
| Irreversible destructive action (purge) | Repudiation/DoS-of-data | Two-stage archive→purge, impact-summary confirm, one transaction; snapshot-less by design (no server) — the confirm IS the safeguard |
| Malicious/untrusted link opening arbitrary scheme | Elevation | Prepend `https://` when no scheme so a raw `javascript:`/`file:` string can't be honored as-is; `Linking.openURL` in try/catch |

## Sources

### Primary (HIGH confidence — verified first-hand on disk this session)
- `src/db/migrations/001-initial.ts` — full schema; confirms `contacts` columns + `contact_links` table exist (no migration needed)
- `src/db/recency-dao.ts` — single-writer `last_contact`, `createContactWithInteraction`, connected-only recompute, interval>0 guard
- `src/db/transaction.ts` + `src/db/mutex.ts` — non-reentrant mutex, core/wrapper pattern
- `src/db/field-values-dao.ts` — `upsertValue`, `getValuesForContact`, `defsForCreateForm/EditForm/visibleDefsForProfile`
- `src/db/field-defs-dao.ts`, `col-name.ts`, `field-sort.ts` — DAO conventions, `isSafeColName`, `sortExpr`
- `src/components/FieldValueInput.tsx` + `field-widgets/*` — reusable custom-field widget dispatcher
- `src/screens/CustomFieldsScreen.tsx`, `HomeScreen.tsx`, `src/components/FieldDefForm.tsx` — screen/form + `Alert` confirm patterns
- `src/theme/theme-presets.ts` + `theme-types.ts` — 8-token palette; where `danger` is added
- `src/db/database.ts` — `foreign_keys = ON`, `localDateTime()`, `getExecutor()`
- `src/types.ts` — `FREQUENCY_DAYS`; `~/projects/Orbit/src/types.ts:84` — birthday `MM-DD | YYYY-MM-DD` convention
- npm registry — datetimepicker 9.1.0, picker 2.11.4, @expo/ui 57.0.11 (versions, repos, no postinstall)

### Secondary (MEDIUM confidence)
- `docs/dossier/06-crud.md`, `04-CONTEXT.md`, `04-UI-SPEC.md` — decisions, findings F1–F4, copy contract
- `.planning/REQUIREMENTS.md` (CRUD-01…06), `STATE.md` (Phase-3 accumulated decisions)

### Tertiary (LOW confidence — flagged for confirmation)
- Navigation library choice (Open Question 1 / A1) — no authoritative in-repo source; owner decision

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages version-verified on registry; most of the data layer already exists and was read on disk.
- Architecture: HIGH — composed-core pattern and single-writer invariant are documented in-repo and verified; only navigation is open.
- Pitfalls: HIGH — every pitfall traces to code read this session (mutex, recompute filter, FK DDL, archived filter).
- Navigation approach: LOW — genuine open decision (A1/OQ1).

**Research date:** 2026-08-14
**Valid until:** 2026-09-13 (30 days — stable local stack; re-verify picker versions if the Expo SDK bumps).
