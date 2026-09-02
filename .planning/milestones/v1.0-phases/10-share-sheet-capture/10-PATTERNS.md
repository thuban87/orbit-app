# Phase 10: Share-Sheet Capture - Pattern Map

**Mapped:** 2026-08-16
**Files analyzed:** 11 new/modified (7 TS/TSX + 2 tests + native patch + config)
**Analogs found:** 9 with strong on-disk analogs / 11 (1 native = no analog by design)

All analogs below were **read on disk**, not inferred. Line numbers are current as of this mapping. The native `finish()` bridge and the `expo-share-intent` Kotlin patch are flagged as net-new native surface with **no direct analog**.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/logic/capture-logic.ts` | logic (pure resolver) | transform | `src/logic/compose-logic.ts` | exact (idiom) |
| `src/logic/capture-logic.test.ts` | test (node/Vitest) | transform | `src/logic/compose-logic.test.ts` (idiom) | exact |
| `src/db/capture-read.ts` | DB read | request-response (read-only) | `src/db/dashboard-read.ts` (`listFavourites`/`listNeverContacted`) | exact |
| `src/db/capture-read.test.ts` | test (DAO/node-sqlite) | request-response | `src/db/fuel-dao.test.ts` (testkit harness) | exact |
| `src/db/capture-dao.ts` (or extend `fuel-dao`) | DB write | batch (multi-row, one txn) | `src/db/fuel-dao.ts` (`addFuelCore`) + `src/db/contacts-dao.ts` (`createContactFull` composition) | exact |
| `src/db/capture-dao.test.ts` | test (DAO/node-sqlite) | batch | `src/db/fuel-dao.test.ts` | exact |
| `src/screens/CaptureScreen.tsx` | screen | event-driven (share intent) | `src/screens/ComposeScreen.tsx` (entry-agnostic self-fetch screen) | role-match |
| face tile / ＋ tile / note surface (inline or `src/screens/capture-*.tsx`) | component (screen-local) | request-response | `src/components/Avatar.tsx` (verbatim) + `ComposeScreen` action/toast idioms | role-match |
| `src/navigation/types.ts` + `RootNavigator.tsx` (modify) | route registration | — | `Compose` route registration (types.ts:56-66, RootNavigator.tsx:72) | exact |
| `app.config.ts` (modify) | config (native plugin) | — | `expo-image-picker` tuple handling (app.config.ts:54-77) | exact |
| `patches/expo-share-intent+8.0.1.patch` + local `finish()` module | native | — | **NO ANALOG** (net-new native) | none |

---

## Pattern Assignments

### `src/logic/capture-logic.ts` (pure resolver, transform)

**Analog:** `src/logic/compose-logic.ts` (read in full)

Mirror the pure-resolver idiom exactly: a react-native-free module, doc-comment stating explicit precedence top-to-bottom, `export interface` for the result shape, one pure function (`same inputs → same output; no I/O; never throws`). `compose-logic.ts` header (lines 1-30) and `resolveComposeControls` (lines 55-100) are the template. Note the explicit-precedence ordering comments (lines 59-93) — capture-logic must document its 4-row payload-mapping table + note-composition branch the same way.

**Precedence to encode (from RESEARCH Q6 / UI-SPEC "Payload → display text"):**
```
(1) note present          → displayText = title ? `${note} — ${title}` : note   (url untouched)
(2) title present (EXTRA_SUBJECT), no note → displayText = title
(3) no title              → displayText = bareURL (fallback) or the prose/text
url column = webUrl (first http… match) or null — ALWAYS canonical, NEVER note-overwritten (F-CAP-6/F-CAP-15)
whitespace-only displayText → NULL at the boundary (fuel-read requires non-blank text)
```

**Interface shape** (mirror compose-logic.ts:32-42):
```typescript
export interface CapturePayload {
  displayText: string | null;   // → fuel.text; NULL when blank
  url: string | null;           // canonical; separate column
}
export function resolveCapturePayload(input: { text: string; webUrl: string | null; title?: string | null; note?: string | null }): CapturePayload { … }
```

**Blank-boundary rule (load-bearing):** `RANKED_FUEL_EXCLUSIONS` drops NULL/blank/whitespace-only `text` in-query (`src/db/fuel-read.ts:100-133`, `NULLIF(TRIM(text, <ws>), '')`). So a whitespace-only display text MUST normalize to `null` here so the row is not silently unrankable-but-present. Node-test the extended-whitespace cases.

---

### `src/logic/capture-logic.test.ts`

**Analog:** `src/logic/compose-logic.test.ts` (idiom) — Vitest `describe`/`it`, no DB. Cover the RESEARCH Q6 edge cases: multi-URL text (first only, document the loss), whitespace→NULL, a note containing an embedded ` — `, empty payload, note+no-title (no trailing separator), title-only, bare-URL fallback.

---

### `src/db/capture-read.ts` (DB read, read-only)

**Analog:** `src/db/dashboard-read.ts` — `listFavourites` (lines 288-295) and `listNeverContacted` (lines 264-282)

Copy the read-chokepoint idiom: pure `export function`, takes `exec: SqlExecutor`, `return exec.getAllAsync<Row>(sql)` — **async only, never sync, no transaction, no mutex** (dashboard-read.ts header lines 1-7; RESEARCH Q4 confirms a mutex-free `getAllAsync` is safe concurrent with the launch sweep). Declare an `export interface` row type like `DashboardRow` (lines 80-94).

**The query (RESEARCH Pattern 1, verified against schema):**
```sql
SELECT c.id, c.name, c.photo, c.modified_at, c.favourite_rank, m.last_captured
  FROM contacts c
  LEFT JOIN (SELECT contact_id, MAX(created_at) AS last_captured
               FROM fuel GROUP BY contact_id) m ON m.contact_id = c.id
 WHERE c.archived_at IS NULL          -- excludes archived; INCLUDES never-contacted
 ORDER BY (c.favourite_rank IS NULL), c.favourite_rank ASC,
          (m.last_captured IS NULL), m.last_captured DESC,
          c.name COLLATE NOCASE ASC;
```

**Critical invariant (CONTEXT/RESEARCH):** MUST NOT inherit `dashboard-read`'s `BASE_WHERE` (lines 142-144) — that clause carries `last_contact IS NOT NULL`, which would exclude never-contacted people. The capture picker uses `archived_at IS NULL` ONLY. Take the `listFavourites`/`listNeverContacted` shape (archived-only filter), NOT `listDashboard`. Capture-MRU derives from `fuel.created_at`+`contact_id` — **no new column, no migration.**

**Search filter:** the tap-to-reveal search live-filters by name; keep it a simple `name LIKE ? ESCAPE '\'` using `escapeLike` from `fuel-read` (dashboard-read.ts:54, 221) if done in SQL, or filter the already-loaded array in the screen (Claude's discretion — the set is small).

---

### `src/db/capture-read.test.ts`

**Analog:** `src/db/fuel-dao.test.ts:42-78` (testkit harness). Use `openTestDb()` + `nodeSqliteExecutor` + `runMigrations(exec, [migration001], 1, …)` in `beforeEach` (lines 43-48); the `seedContact` helper (lines 50-58) inserts a bare contact (with a NULL `last_contact` for never-contacted rows). Assert ordering: a favourite outranks a recently-captured non-favourite; a never-contacted contact is INCLUDED; an archived contact is EXCLUDED.

---

### `src/db/capture-dao.ts` — multi-attach composer (DB write, batch)

**Analogs:** `src/db/fuel-dao.ts` (`addFuelCore`, lines 129-150) + `src/db/contacts-dao.ts` (`createContactFull` composition contract, lines 106-184) + `src/db/transaction.ts` (`inWriteTransaction`, lines 42-57)

**The exact shape (RESEARCH Q5, and fuel-dao.ts:16-19 names this phase by name):**
```typescript
// Compose the NON-mutexed core N times inside ONE inWriteTransaction — never nest the mutex.
export function captureMultiAttach(exec: SqlExecutor, rows: NewFuelItem[]): Promise<void> {
  return inWriteTransaction(exec, async () => {
    for (const row of rows) await addFuelCore(exec, row);  // one BEGIN, N inserts, atomic
  });
}
```

**Non-negotiables enforced by the analogs:**
- **NON-REENTRANT mutex** (transaction.ts:11-29): never call `addFuel`/`inWriteTransaction` inside the loop — that is the documented permanent hang. Compose `addFuelCore`, wrap once. `createContactFull` (contacts-dao.ts:129-183) is the canonical "compose cores in one txn" precedent.
- **Capture uses the FUEL writer ONLY** — `addFuelCore` with `kind:'topic'`, `source:'share'`. NEVER `recomputeLastContactCore`, NEVER an interaction row (capture is not a touchpoint; DATA-04 single-writer stays intact). `FuelSource` already documents `'share'` (fuel-dao.ts:44-50).
- **`?`-bound, both-keys guard** already live inside `addFuelCore`/`editFuelCore` — reuse, do not re-hand-roll INSERTs.
- **Note application:** the note edits the just-written row(s) via `editFuelCore` (fuel-dao.ts:163-195) — a patch-scoped UPDATE of `text` only (`url`/`created_at` untouched). For multi-attach, apply the note's composed `text` to all N rows.

**Single-tap path:** use the standalone `addFuel` wrapper (fuel-dao.ts:240-245) — one row, one transaction.

**Inline-create-then-capture:** `createContactFull` with `firstInteraction` OMITTED (contacts-dao.ts:88-91, 152-161) → `last_contact` stays NULL (never-contacted), returns `{ contactId }`; then a separate `addFuel` to that id. Two transactions is acceptable (RESEARCH Q5) — the created contact is immediately valid.

---

### `src/db/capture-dao.test.ts`

**Analog:** `src/db/fuel-dao.test.ts` (full harness). Assert: N rows written atomically (a throw mid-loop rolls back all N — mirror contacts-dao's mid-composition ROLLBACK test); each row has its own `uid`; **no-touchpoint assertion** — grep/verify the capture path writes NO `last_contact` and NO interaction row (`SELECT last_contact FROM contacts` stays NULL after a capture onto a never-contacted contact). `source='share'`, `kind='topic'`.

---

### `src/screens/CaptureScreen.tsx` (screen, event-driven)

**Analog:** `src/screens/ComposeScreen.tsx` (read in full) — the entry-agnostic self-fetching screen

Reuse these ComposeScreen idioms verbatim:
- **DB access:** `getExecutor()` + `localDateTime()` from `@/db/database` (ComposeScreen.tsx:55, 131, 303); mint uids with `newUid()` from `@/db/uid`.
- **Self-fetch on focus** with a `cancelled` guard flag (lines 125-194) — the picker loads `capture-read` results the same way; guard every post-await setter.
- **Transient toast = `setState` + `setTimeout`, NEVER per-frame animation** (lines 107-108, 249-264, 208-216: the "Copied" pattern). The "Saved to {name}" toast + `AUTO_RETURN_MS` timer follow this exactly — a `useRef` timer id, cleared on unmount and before re-arming. This is a CLAUDE.md hard rule.
- **Write failure → native `Alert`** (lines 236-241, "Couldn't save" / "Please try again" per UI-SPEC).
- **All colours via `useTheme().colors.*`** (line 90) — zero hex; `AUTO_RETURN_MS` a top-of-file tunable (CLAUDE.md tunable-constants rule).
- **testIDs + accessibilityRole/Label on every Pressable** (lines 269-277) — the UI-SPEC locks the full testID set for uiautomator UAT.
- **`minHeight: 44` touch-target floor** on every Pressable (styles lines 555-581).

**Grid:** `FlatList` `numColumns:3`, `contentContainerStyle:{ padding:16 }`, item `gap:12` (UI-SPEC Screen Layout). The recycling grid MUST pass `Avatar` `recyclingKey`/`cacheBust` (see below) — a correctness req, not an optimisation.

**Share-intent entry:** the screen drains `useShareIntent()` (the new native dep) and feeds the raw payload to `resolveCapturePayload` (capture-logic). Keep the screen on the `ready`-gated navigator (RESEARCH Q4) — do NOT add a pre-`ready` fast path; migrations must be complete before the read.

---

### Face tile / ＋ tile / confirmation-note surface (screen-local components)

**Analog:** `src/components/Avatar.tsx` (used VERBATIM) + ComposeScreen style idioms

- **Avatar:** `<Avatar photo name contactId cacheBust={modified_at} size={64} />` — exactly as ComposeScreen.tsx:315-321. The `cacheBust=modified_at` + internal `recyclingKey` (Avatar.tsx:64, 78) is the anti-face-flash correctness pattern required in a recycling grid.
- **Back/close pill:** copy the `backPill` idiom (ComposeScreen.tsx:268-278) + `backBtn` style (border, radius 8, paddingH 14/paddingV 8, `colors.textSecondary`) — matches UI-SPEC Close pill.
- **Filled-accent primary button** ("Done · N", "Create & save"): the Send/Copy primary style (ComposeScreen.tsx:441-456, styles `actionBtn`/`actionText`) — `backgroundColor: colors.accent`, label `colors.background`.
- **Accent-text secondary** ("Add a note", note "Done"): the `addNumberText` idiom (ComposeScreen.tsx:417, 559-562) — `color: colors.accent`, 16/600.
- **Note TextInput:** the `draftInput` idiom (ComposeScreen.tsx:383-398, styles 544-554) — `surface` bg, `border`, radius 8, multiline, `textAlignVertical:"top"`.

Whether these are inline sub-components or small extracted files is Claude's discretion (UI-SPEC Component Inventory). No new colour token, spacing value, or type size this phase — all lifted from theme + ContactCard/Compose.

---

### `src/navigation/types.ts` + `RootNavigator.tsx` (route registration)

**Analog:** the `Compose` route (types.ts:56-66, RootNavigator.tsx:3, 72)

Register additively, exactly like `Compose`/`NeverContacted`/`ManageFavourites`:
- types.ts: add `Capture: undefined;` (or params if the share payload is threaded via route — but RESEARCH has the screen drain `useShareIntent` directly, so likely `undefined`). Serializable params only, NO callback params (types.ts:56-62).
- RootNavigator.tsx: import the screen (lines 1-12) and add `<Stack.Screen name="Capture" component={CaptureScreen} />` (line 72 pattern). `initialRouteName` stays `Home`; `screenOptions={{ headerShown:false }}` already set (line 54) — the capture screen owns its Close chrome.

---

### `app.config.ts` (native plugin registration)

**Analog:** the `expo-image-picker` tuple handling (app.config.ts:54-77)

The share-intent plugin is a **`[name, options]` tuple** (`["expo-share-intent", { androidIntentFilters: ["text/plain"] }]`), so — exactly like `pickerPlugin` (lines 68-71) — it **cannot be Set-deduped** (a tuple is a distinct member from a bare string). Mirror the pattern: filter the name out of the string-plugin Set, then append the tuple once (lines 73-76). A duplicate plugin entry is a prebuild error (01-01 lesson, comment lines 36-37).

Also required (RESEARCH Q2): add a top-level `scheme: "orbit"` (currently absent) — the plugin requires one. Do NOT set `androidMultiIntentFilters` (keeps `ACTION_SEND_MULTIPLE` out of v1 scope).

Note the header comment (lines 2-13): this config is loaded by Expo's native TS loader — do NOT introduce a `.ts` import or a `tsx/cjs` hook. The `patch-package` `postinstall` (RESEARCH Q1) is a plain diff-applier and does NOT touch this hazard.

---

### `patches/expo-share-intent+8.0.1.patch` + local `finish()` module — NET-NEW NATIVE (no analog)

**Flagged: no existing analog in this repo.** This is the only genuinely new-risk surface, Pixel-UAT only.
- **Kotlin patch (RESEARCH Q1):** `patch-package` diff adding `EXTRA_SUBJECT` fallback to `ExpoShareIntentModule.kt` (~line 132): `intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: intent.getCharSequenceExtra(Intent.EXTRA_TITLE)`. Add `patch-package` devDep + `"postinstall": "patch-package"`; commit `patches/`.
- **`finish()` bridge (RESEARCH Q3):** ~10-line local Expo native module exposing `finish()` → `appContext.currentActivity?.finish()`. Do NOT use `BackHandler.exitApp()` (RN-version-dependent mapping may land on home).
- Both require `expo prebuild --clean` + release APK via the desktop pipeline; invisible to a Metro reload. There is nothing in `src/` to copy from — the closest procedural reference is `app.config.ts`'s existing native-plugin registrations and the desktop-build-pipeline runbook.

---

## Shared Patterns

### Fuel writer (NEVER the last_contact DAO)
**Source:** `src/db/fuel-dao.ts` (`addFuel`/`addFuelCore` lines 129-150, 240-245) + `src/db/transaction.ts` (`inWriteTransaction` 42-57)
**Apply to:** every capture write path (single-tap, multi-attach, inline-create-then-capture).
Capture is never a touchpoint — `source:'share'`, `kind:'topic'`, no `last_contact`/interaction write. The mutex is non-reentrant: compose `*Core` variants, wrap in ONE `inWriteTransaction`.

### Pure-resolver logic extraction
**Source:** `src/logic/compose-logic.ts`
**Apply to:** all correctness-critical parsing/composition (`capture-logic.ts`). React-native-free, node-tested under Vitest; `.tsx` stays Pixel-UAT.

### Read chokepoint (async, mutex-free, archived-filtered)
**Source:** `src/db/dashboard-read.ts` (`listFavourites` 288-295, `listNeverContacted` 264-282)
**Apply to:** `capture-read.ts`. `getAllAsync` only; `archived_at IS NULL` filter; NEVER the `last_contact IS NOT NULL` base.

### Transient confirmation via setState + setTimeout (never per-frame animation)
**Source:** `src/screens/ComposeScreen.tsx` "Copied" pattern (107-108, 208-216, 249-264)
**Apply to:** the "Saved to {name}" toast + `AUTO_RETURN_MS` auto-return. CLAUDE.md hard rule; `useRef` timer cleared on unmount + before re-arm.

### Theme tokens + testIDs + 44px touch targets
**Source:** `ComposeScreen.tsx` (colours via `useTheme().colors.*`; testID/accessibility on every Pressable; `minHeight:44`) + `Avatar.tsx` (colours only via tokens)
**Apply to:** every capture surface. Zero hex outside `theme-presets.ts` (check:colors gate); UI-SPEC locks the testID set.

### DAO node-sqlite test harness
**Source:** `src/db/fuel-dao.test.ts:42-78` (`openTestDb` + `nodeSqliteExecutor` + `runMigrations([migration001])` + `seedContact`)
**Apply to:** `capture-read.test.ts`, `capture-dao.test.ts`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `patches/expo-share-intent+8.0.1.patch` | native (Kotlin) | — | No native module patch exists in this repo yet — net-new native surface |
| local `finish()` Expo module | native (Kotlin) | — | No local native module exists yet; `BackHandler.exitApp()` explicitly rejected (RESEARCH Q3) |

Both are Pixel-UAT-only per RESEARCH; the planner uses RESEARCH Q1/Q3 code sketches, not a codebase analog.

---

## Metadata

**Analog search scope:** `src/logic/`, `src/db/`, `src/components/`, `src/screens/`, `src/navigation/`, `app.config.ts`
**Files read on disk:** compose-logic.ts, fuel-dao.ts, transaction.ts, contacts-dao.ts, dashboard-read.ts, Avatar.tsx, ComposeScreen.tsx, RootNavigator.tsx, navigation/types.ts, app.config.ts, fuel-dao.test.ts (+ fuel-read.ts / database.ts / uid.ts grep-verified)
**Pattern extraction date:** 2026-08-16
</content>
</invoke>
