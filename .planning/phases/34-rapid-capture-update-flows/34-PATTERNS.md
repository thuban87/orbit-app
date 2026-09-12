# Phase 34: Rapid Capture & Update Flows - Pattern Map

**Mapped:** 2026-09-12
**Files analyzed:** 12 (new + modified)
**Analogs found:** 12 / 12 (all in-repo; zero external, per UI-SPEC Registry Safety)

> All analog excerpts below were opened on disk this session and quoted verbatim with file:line
> ("review the code, not the diff"). Where the RESEARCH doc and disk diverge, the disk reading wins
> and is called out — see the D-11 memory-registry note under Shared Patterns.
>
> **Composition, not cloning.** Per UI-SPEC scope note and RESEARCH anti-patterns, `TouchpointRefineForm`,
> `MemoryEditor`, `TriStateLastSpoke`, `SegmentedControl`, `FrequencyPicker`, `ContactPicker`, `Snackbar`,
> `Button`, `AppText`, `Icon` are **composed**, never re-implemented. This map assigns patterns to the
> NEW glue (pure `*-logic.ts` modules, one migration, DAO extensions, screen wiring) — not to the
> primitives it consumes.

---

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|---------|------|-----------|----------------|---------------|
| `src/db/migrations/027-<default-channel-pref>.ts` | NEW | migration | transform (DDL) | `src/db/migrations/020-dashboard-swipe-pref.ts` | exact (app_settings additive ALTER + CHECK) |
| `src/db/migrations/027-*.test.ts` | NEW | test | — | `src/db/migrations/020-dashboard-swipe-pref.test.ts` | exact |
| `src/db/app-settings-dao.ts` (extend) | MOD | model/DAO | CRUD | (self — `dashboardRightSwipeAction` idiom) | exact (in-file precedent) |
| `src/backup/backup-schema.ts` (extend `PORTABLE_SETTINGS_KEYS`) | MOD | config | transform | (self — Phase 23/25 declare-only keys) | exact (in-file precedent) |
| `src/screens/log-interaction-logic.ts` | NEW | utility (pure logic) | transform (defaulting) | `src/screens/create-contact-logic.ts` | role+flow match |
| `src/screens/log-interaction-logic.test.ts` | NEW | test | — | `src/screens/create-contact-logic.test.ts` | exact |
| `src/screens/LogInteractionScreen.tsx` (fills `LogContact` route) | NEW | screen | request-response | `FabActionPlaceholders.tsx` (replaces) + composes `TouchpointRefineForm` | role match |
| `src/screens/update-contact-*-logic.ts` (+test) | NEW | utility (pure logic) | event-driven (chooser loop) | `src/screens/create-contact-logic.ts` (build+gate split) | role match |
| `src/screens/UpdateContactScreen.tsx` (fills `UpdateContact` route) | NEW | screen | request-response | `FabActionPlaceholders.tsx` (replaces) | role match |
| Quick-Log post-log editor logic (extend `quick-log-command.ts` + new `*-logic.ts`) | MOD/NEW | service/utility | event-driven | `src/services/quick-log-command.ts` | exact (in-file precedent) |
| Add Contact restructure — `create-contact-logic.ts` (extend) + `CreateContactScreen.tsx` (IA) | MOD | screen + logic | CRUD | (self — already the real screen) | exact (in-file precedent) |
| `src/db/memory-registry.ts` (D-11 displayName repoint) | MOD | config | — | (self) | exact (constant edit) |
| Edit Contact accordion IA — `edit-contact-logic.ts` + `EditContactScreen.tsx` | MOD | screen + logic | CRUD | `create-contact-logic.ts` split | exact (in-file precedent) |

---

## Pattern Assignments

### `src/db/migrations/027-<default-channel-pref>.ts` (migration, transform)

**Analog:** `src/db/migrations/020-dashboard-swipe-pref.ts` (opened on disk; full file, 18 lines)

**Copy the whole shape verbatim** — additive, forward-only, one `ALTER TABLE app_settings ADD COLUMN`
per column with `NOT NULL DEFAULT … CHECK(… IN (…))`. The NOT NULL default seeds the singleton settings
row on every version-to-27 upgrade (no data backfill needed):

```typescript
// src/db/migrations/020-dashboard-swipe-pref.ts:9-18
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

**Concrete new columns** (names/values are Claude's discretion per RESEARCH A1 — finalize at plan time):
- `default_interaction_channel TEXT NOT NULL DEFAULT 'remember' CHECK(default_interaction_channel IN ('remember','Message','Call','In Person'))`
- `remembered_interaction_channel TEXT NOT NULL DEFAULT 'Message'`

CHECK literals MUST match the migrated stored vocabulary (`Message`/`Call`/`In Person`) — the same
values migration 025 wrote into `interactions.channel`.

**Registration (verified on disk — do NOT assume the number):** current head is **26**.
`src/db/database.ts:67` `export const TARGET_VERSION = GROUP_EVENTS_SCHEMA_VERSION;` and
`GROUP_EVENTS_SCHEMA_VERSION = 26`. The `MIGRATIONS` array ends `…migration025, migration026`
(`database.ts:95-96`). **Migration 024 has no `024-` filename** — it is `profilePresentationMigration`
(version 24). So the next file is `027-*.ts`, added to the `MIGRATIONS` array and bumping `TARGET_VERSION`.
Do NOT touch `interactions` — CAPT-15 vocab migration is already shipped (025). A second `interactions`
UPDATE is the STOP-AND-ASK double-migration hazard.

---

### `src/db/app-settings-dao.ts` (model/DAO, CRUD) — EXTEND, don't clone

**Analog:** the `dashboardRightSwipeAction` end-to-end wiring already in this file (in-file precedent).

Thread each new column through the SAME six touchpoints the `dashboard_right_swipe_action` column uses:

1. `AppSettings` interface field (near line 206: `dashboardRightSwipeAction: RightSwipeAction;`)
2. `AppSettingsPatch` optional field (near line 322)
3. `WritableSettingsKey` union member (near line 403)
4. row-shape type + SELECT column list (near lines 439, 566)
5. `COLUMN_OF` map entry (line 497+; e.g. `dashboardRightSwipeAction: "dashboard_right_swipe_action"` at 533)
6. row→object hydration (lines 623-624)

**Validator idiom** (copy `assertDashboardRightSwipeAction`, `app-settings-dao.ts:910-922`):

```typescript
export function assertDashboardRightSwipeAction(field: string, v: unknown): void {
  if (
    typeof v !== "string" ||
    !(RIGHT_SWIPE_ACTIONS as readonly string[]).includes(v)
  ) {
    throw new Error(
      `updateAppSettings: ${field} must be a known right-swipe action, got ${String(v)}`,
    );
  }
}
```

Wire the validator into `updateAppSettings` the same way (guard block at lines 1019-1022). The generic
patch loop over `COLUMN_OF` (lines 1128-1131) then persists it via `?`-bound assignments — no raw SQL
in a screen (RESEARCH "Don't Hand-Roll"). **D-09:** `remembered_interaction_channel` is written ONLY
inside the successful ordinary-save path; never on cancel, never for Group Log.

---

### `src/backup/backup-schema.ts` (config, transform) — declare-only allowlist

**Analog:** the Phase 23/25 "allowlisted NOW, emitted later" comment block already in this file.

Add BOTH new keys to `PORTABLE_SETTINGS_KEYS` (the `Set` opened at `backup-schema.ts:133`) **declare-only**:
accepted on restore, NOT emitted by `getPortableSettingsSnapshot`, **NO `BACKUP_FORMAT_VERSION` bump**.
This mirrors the shipped precedent (comments at 156-189: Phase 23/25 keys "allowlisted NOW … emission +
BACKUP_FORMAT_VERSION bump … [later] scope"). Emission is Phase 36's job (D-03 milestone order:
schema → consumers → backup). The restore guard at line 221 (`!PORTABLE_SETTINGS_KEYS.has(key)`) is what
makes allowlisting sufficient for accept-on-restore.

---

### `src/screens/log-interaction-logic.ts` (utility, transform) — NEW pure module

**Analog:** `src/screens/create-contact-logic.ts` (the canonical RN-screen ↔ pure-logic split).

This file does not exist yet (verified: `ls` → no such file). Follow the create-contact split exactly:
a react-native-free module that owns the correctness rules and is node-tested, while the `.tsx` screen
stays presentational. The module header + `canSave` + builder pattern to copy:

```typescript
// src/screens/create-contact-logic.ts:64-69 — the Save gate lives in pure logic, node-tested
export function canSave(state: CreateFormState): boolean {
  return (
    state.name.trim().length > 0 &&
    (state.trackingEnabled === false || state.intervalValid)
  );
}
```

**What this module owns (CAPT-08, the genuinely-new logic):** channel-sensitive Direction/Connected
defaulting over the controlled `TouchpointRefineForm`. Per RESEARCH Pattern 2 + dossier §R/§S:
`In Person` → Direction default `mutual`, Connected hidden (`connected: 1`); `Message`/`Call` →
Direction default `outbound`, Connected shown default `1`. Guard: only apply the default while the user
has NOT explicitly overridden Direction — do not re-fight overrides on unrelated re-renders. Direction
enum is `outbound|inbound|mutual`, Connected is `0/1` (verified `TouchpointRefineForm.tsx:85`).
Backdate handling / future-datetime reject reuses the locked `FUTURE_DATETIME_MESSAGE` +
`touchpoint-refine-logic` guards — do not re-author.

---

### `src/screens/LogInteractionScreen.tsx` (screen, request-response) — fills the `LogContact` route

**Analog:** replaces `LogContactPlaceholderScreen` (`FabActionPlaceholders.tsx:32-39`); composes
`TouchpointRefineForm`.

The route already exists and is typed — do NOT rename it (STOP-AND-ASK #6; internal id stays `LogContact`,
only user-facing copy reads "Log Interaction" per D-11):

```typescript
// src/navigation/types.ts:45
LogContact: { contactId?: number; prefillDate?: string } | undefined;
```

`prefillDate` (local `YYYY-MM-DD`) prefills the day for History-originated logs (CAPT-13);
untargeted invocation uses `ContactPicker`. The screen is presentational: it owns React state,
delegates rules to `log-interaction-logic.ts`, and calls the recency spine (`editTouchpointFull` /
`recordTouchpoint`) — never inline SQL, never a bare `…Core`.

**Placeholder shape being replaced** (note it uses raw `Text`/`fontSize`/`fontWeight` — the REAL screen
must use `AppText` roles + theme tokens, per UI-SPEC; the placeholder is not a style analog):

```typescript
// src/screens/placeholders/FabActionPlaceholders.tsx:32-39
export function LogContactPlaceholderScreen() {
  return (
    <FabActionPlaceholder
      message="Detailed logging arrives with Rapid Capture."
      title="Log Contact"
    />
  );
}
```

---

### Quick-Log post-log editor (service/utility, event-driven) — EXTEND `quick-log-command.ts`

**Analog:** `src/services/quick-log-command.ts` (in-file precedent; injected-deps + snackbar contract).

`runQuickLog` already writes immediately and shows the locked **Logged / Undo** snackbar with
single-flight via `pendingRef`; failure shows **Couldn't log / Retry** (`quick-log-command.ts:81-126`).
The dependency-injection shape (`RunQuickLogDeps`, lines 38-48) is the pattern to extend — new side
effects go in as injected functions so the command stays node-testable.

**Phase 34 adds (CAPT-05):** an **Add Note** affordance on the success snackbar opening a small post-log
editor bound to the just-created `interactionId`. It saves EITHER an Interaction Note (via
`editTouchpointFull` seeded from `readInteractionForEdit`) OR a Memory (via `addMemory`) — **never both**
(dossier §I). Put the branch decision in a new pure `*-logic.ts` + colocated `.test.ts`.

**Do NOT change** the hardcoded `channel: "unspecified"` (lines 92-97) to adopt the Default Channel
pref without owner sign-off (RESEARCH A2 / open decision — Quick Log is not a form and collects no
channel). Flag if consequential.

---

### `src/screens/update-contact-*-logic.ts` + `UpdateContactScreen.tsx` (chooser loop, event-driven)

**Analog:** `create-contact-logic.ts` build+gate split for the logic; `UpdateContactPlaceholderScreen`
(`FabActionPlaceholders.tsx:50-57`) for the route being filled.

Route is typed and placeholder-backed:

```typescript
// src/navigation/types.ts:59
UpdateContact: { contactId?: number } | undefined;
```

CAPT-12: after the contact is known, a compact chooser lists built-in actions (Last Talked About,
Key People, Current Location, Memory, Off Limits, Contact Method, Contact Frequency) + named custom
fields; selecting an item opens a focused editor whose inner Save returns to the chooser with the same
contact targeted; **Done** exits. Each inner save persists independently (NOT one giant transaction).
Chooser rows are driven by the Contact Knowledge registry (dossier §Y), never a hardcoded table.
Pure-logic module owns row assembly / applicability filtering (omit inapplicable named custom-field rows,
keep the generic Custom Fields row); the screen is presentational.

---

### Add Contact restructure — `create-contact-logic.ts` (extend) + `CreateContactScreen.tsx` (IA only)

**Analog:** the file itself — it is the REAL, shipped create path (not a placeholder), verified
`create-contact-logic.ts:1-127`.

CAPT-01/02/03 are IA restructuring (3 sections Identity / Relationship Basics / Contact Methods +
Show More), not new persistence. `canSave` (name-only gate, lines 64-69), `firstInteractionOccurredAt`
(tri-state → occurred_at, lines 76-88), and `buildCreateInput` (`CreateContactFullInput` assembly,
lines 96-127) already implement the rules. **CAPT-02 / ADR-016 preservation is load-bearing**: keep
`TriStateLastSpoke` in Relationship Basics defaulting "today"; the "not yet" branch MUST keep omitting
`firstInteraction` entirely (no row, NULL last_contact) — dropping the control is a STOP-AND-ASK reversal.

```typescript
// src/screens/create-contact-logic.ts:76-88 — the tri-state → occurred_at rule (KEEP; ADR-016)
export function firstInteractionOccurredAt(lastSpoke: LastSpokeValue, now: string): string | null {
  switch (lastSpoke.kind) {
    case "today":  return now;
    case "date":   return `${lastSpoke.date} 00:00:00`;
    default:       return null;   // "not yet" → NO interaction row
  }
}
```

```typescript
// create-contact-logic.ts:118-125 — "not yet" omits firstInteraction; date/today attach it
if (occurredAt !== null) {
  input.firstInteraction = { uid: deps.interactionUid, occurredAt, source: "manual", direction: null };
}
```

**Edit Contact accordion** (CAPT-04) follows the identical screen↔logic split via
`edit-contact-logic.ts` (exists, verified) — IA restructure into top-level accordions, no nested
Things-to-Remember; no new persistence.

---

### `src/db/memory-registry.ts` (config) — D-11 displayName repoint

**Analog:** the file itself (constant edit).

**DISK STATE (verified `memory-registry.ts:10-58`), which differs from the RESEARCH doc's paraphrase —
trust disk:**

```typescript
// memory-registry.ts:10, 12, 15
export const PROVISIONAL_MEMORY_LABEL = "Memory";
export const PROVISIONAL_DEFAULT_MEMORY_TYPE_NAME = "General";
export const DEFAULT_MEMORY_TYPE_KEY: MemoryTypeKey = "general";
// :29-30    general: { displayName: PROVISIONAL_DEFAULT_MEMORY_TYPE_NAME, … }  → shows "General"
// :49-50    custom:  { displayName: PROVISIONAL_MEMORY_LABEL, … }             → shows "Memory"
```

**D-11 (owner, 2026-09-12, CONTEXT.md) is a SWAP of the two current display names:**
- `MEMORY_TYPE_REGISTRY.general.displayName` → **"Memory"**
- `MEMORY_TYPE_REGISTRY.custom.displayName` → **"Custom"**

CONTEXT.md leaves it to the planner whether to retire/repoint the two provisional constants or set the
values directly. Either way: rapid capture must still request the default type by
`DEFAULT_MEMORY_TYPE_KEY = "general"`, never by a hardcoded display name or type ID. `MemoryEditor`
renders `MEMORY_TYPE_REGISTRY[type].displayName` (verified), so this single edit changes the label
everywhere.

> ⚠ Note for planner: RESEARCH's §Assumptions A3 / discrete-value note says "keep the shipped
> `PROVISIONAL_MEMORY_LABEL` value" and points `general` at "Memory" but is SILENT on `custom` →
> "Custom". CONTEXT.md D-11 is authoritative and names BOTH. Apply BOTH renames to avoid the duplicate
> "Memory" label.

---

## Shared Patterns

### Recency spine — the ONLY interaction write path
**Source:** `src/db/recency-dao.ts` (`recordTouchpoint`, `editTouchpointFull`, `deleteTouchpoint`,
`createContactWithInteraction`; cores `insertInteractionCore` / `recomputeLastContactCore`).
**Apply to:** every new/modified screen and logic module that writes an interaction (Log Interaction,
Quick Log post-log note, Add Contact first-interaction, Update Contact).
Use the mutexed wrappers from top-level handlers; only compose `…Core` inside an already-open txn.
Never write `interactions`/`contacts.last_contact` directly (ADR-010/024/071). No set-based writes.

### RN screen ↔ pure-logic split (project-standard)
**Source:** `src/screens/create-contact-logic.ts` (+ `touchpoint-refine-logic.ts`, `tri-state-last-spoke-logic.ts`).
**Apply to:** ALL new forms/choosers. Correctness rules go in a react-native-free `*-logic.ts` with a
colocated `.test.ts` (vitest node env — `.tsx` screens are NOT loadable). Screen stays presentational.
This is a Wave-0 gap for `log-interaction-logic.ts` and the update-contact/post-log-note modules.

### Local date/time — never `toISOString().split`
**Source:** `src/utils/dates.ts` (`formatLocalDate` / `localDateTime`); enforced across `recency-dao.ts`.
**Apply to:** every date/time value in new logic. Banned: `toISOString().split('T')[0]` (UTC off-by-one).

### Theme tokens only — `check:colors` gate
**Source:** `src/theme/` + UI-SPEC token table. **Apply to:** every new/modified `.tsx`. Colour resolves
through `useTheme().colors.*`; zero hex/named literals. Note the placeholder screens use raw `fontSize`/
`fontWeight` — the real screens must use `AppText` roles instead. Gate: `npm run check:colors`.

### Privacy gate — Allow AI default OFF (STOP-AND-ASK)
**Source:** `interactions.allow_ai` (migration 025, NOT NULL DEFAULT 0) + `coerceAllowAi`
(`touchpoint-refine-logic.ts:176-178`) + `ai-context-read.ts` (never selects the note column).
**Apply to:** the Log Interaction Allow AI toggle. Default OFF; never route a Group Note through it
(ADR-078). Any `allowAi: 1` default or group-note path touching the toggle = STOP AND ASK (owner-bucket).

### Vocabulary map — single source of truth (verify-only)
**Source:** `src/db/interaction-vocabulary.ts` (`remapLegacyQuality/Channel`). CAPT-15 is
satisfied-by-dependency (Phase 32 migration 025). **Apply as a verification task only:** grep for
straggler legacy literals (`'good'/'fine'/'hard'/'text'/'email'`) in any writer/reader. Author NO new
`interactions` vocabulary migration.

---

## No Analog Found

None. Every Phase-34 file has a strong in-repo analog (this phase is composition + IA over shipped
infrastructure, confirmed by RESEARCH). No file needs to fall back to RESEARCH.md generic patterns.

---

## Metadata

**Analog search scope:** `src/db/`, `src/db/migrations/`, `src/screens/`, `src/services/`,
`src/components/`, `src/backup/`, `src/navigation/`.
**Files opened & quoted on disk this session:** `migrations/020-dashboard-swipe-pref.ts`,
`database.ts` (migration list + TARGET_VERSION), `create-contact-logic.ts`, `quick-log-command.ts`,
`app-settings-dao.ts` (interface/COLUMN_OF/validator regions), `memory-registry.ts`,
`backup/backup-schema.ts` (PORTABLE_SETTINGS_KEYS), `navigation/types.ts`,
`screens/placeholders/FabActionPlaceholders.tsx`; confirmed existence of `edit-contact-logic.ts` and
non-existence of `log-interaction-logic.ts`.
**Divergence flagged:** RESEARCH's D-11 memory-registry paraphrase vs disk — see the memory-registry
assignment. CONTEXT.md D-11 (both renames) is authoritative.
**Pattern extraction date:** 2026-09-12
</content>
</invoke>
