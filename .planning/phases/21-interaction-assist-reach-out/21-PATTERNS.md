# Phase 21: Interaction Assist & Reach Out - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 15 (10 new, 5 modified)
**Analogs found:** 15 / 15 (every file has a verified on-disk analog)

> All analog line numbers below were verified by opening the actual file this session (per CLAUDE.md
> "Review the code, not the diff"). Where RESEARCH.md's cited line drifted, the corrected value is noted.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/migrations/014-interaction-assists.ts` | migration | batch (DDL) | `src/db/migrations/013-reconciliation-and-merge.ts` + `005-digest-settings.ts` | exact |
| `src/db/interaction-assist-dao.ts` | DAO (write) | CRUD / transform | `src/db/recency-dao.ts`, `src/db/merge-dao.ts` | exact |
| `src/db/interaction-assist-read.ts` | DAO (read) | CRUD (query) | `src/db/contact-methods-read.ts` | exact |
| `src/services/reach-out/handoff.ts` | service | event-driven (OS intent) | `src/screens/ComposeScreen.tsx` `onSend` (SMS) | role-match |
| `src/services/interaction-assist-sweep.ts` | service | batch (launch sweep) | `src/services/launch-sweep.ts` (`registerSweepHook`) | exact |
| `src/stores/assist-store.ts` | store | event-driven (AppState) | `src/stores/dashboard-prefs-store.ts` (Zustand shape) | role-match |
| `src/components/ReachOutRouter.tsx` | component | request-response | `src/components/OverflowMenu.tsx` | role-match |
| `src/components/EndpointSelector.tsx` | component | request-response | `src/components/OverflowMenu.tsx` + `ComposeScreen.tsx` actionBtn | role-match |
| `src/components/AssistBanner.tsx` | component | event-driven | `src/components/BirthdayBanner.tsx` | role-match |
| `src/components/AssistConfirmation.tsx` | component | request-response | `src/screens/ComposeScreen.tsx` (`aiPanel`/`aiPanelActions`) | role-match |
| `src/db/database.ts` (MODIFY) | config | — | self (TARGET_VERSION + MIGRATIONS list) | exact |
| `src/db/merge-dao.ts` (MODIFY) | DAO | CRUD | self (reparent array line 153) | exact |
| `src/db/app-settings-dao.ts` (MODIFY) | DAO | CRUD | self (`COLUMN_OF` + types + `getAppSettings`) | exact |
| `src/navigation/widget-linking.ts` (MODIFY) | route resolver | request-response | self (allow-list pattern) | exact |
| `src/services/widget/widget-render.tsx` (MODIFY) | component | — | self (LargeTile ActionButton, lines 452-459) | exact |

---

## Pattern Assignments

### `src/db/interaction-assist-dao.ts` (DAO write — the core)

**Analogs:** `src/db/recency-dao.ts` (the authoritative writer it MUST call), `src/db/merge-dao.ts` (txn + reparent idiom).

**CRITICAL — confirmation MUST route through `recordTouchpoint`, never a bespoke `interactions` INSERT or `last_contact` write.** `recency-dao.ts:1-12` declares itself the ONLY writer of `contacts.last_contact` (DATA-04). A second writer breaks `rarely_responds`, gravity, and status.

**`recordTouchpoint` verified signature** (`recency-dao.ts:59-78`, exported at `:217`):
```typescript
export interface RecordTouchpointInput {
  contactId: number;
  uid: string;              // caller-minted, e.g. newUid()
  occurredAt: string;       // local YYYY-MM-DD HH:MM:SS — status reads this
  now: string;              // local wall-clock now → recorded_at + modified_at
  channel?: string;         // free text, no CHECK
  direction?: string | null;
  connected?: number;       // 0/1; default 1
  quality?: string | null;
  note?: string | null;
  source?: string;          // free text; default 'manual'
}
export function recordTouchpoint(exec, input): Promise<{ interactionId: number }>
```

**Confirmation call (Pattern 1 — verified against the real signature):**
```typescript
await recordTouchpoint(exec, {
  contactId: assist.contact_id,
  uid: newUid(),                    // uid.ts:18 — NOT crypto.randomUUID (Hermes has no globalThis.crypto)
  occurredAt: assist.handoff_at,    // Cluster R: handoff time, NOT confirmation time
  now: localDateTime(),             // database.ts:74 — confirmation time
  channel: assist.channel,          // 'call' | 'text' | 'email'
  direction: "outbound",            // Cluster S — all Phase-21 rows outbound
  connected: answered ? 1 : 0,      // Call 'No answer' → 0 (Cluster T)
  note: note ?? null,               // Cluster K
  source: "assist",                 // free-text; distinct from 'manual'
});
// then, SAME transaction: UPDATE interaction_assists SET status='logged', resolved_at=?, modified_at=?
```
Note: `recordTouchpoint` opens its OWN `inWriteTransaction` and calls `rejectFutureOccurredAt` synchronously before the txn. The assist-status UPDATE therefore cannot share `recordTouchpoint`'s internal transaction — either sequence them (touchpoint, then a second txn to flip status) or extract a `recomputeLastContactCore`-style non-mutexed core if a single atomic txn is required. Flag for planner: `recordTouchpoint` is mutexed/self-transacting; there is no exported "core" variant for it (unlike `recomputeLastContactCore`). Prefer sequencing over trying to nest — a nested `inWriteTransaction` is a PERMANENT hang (mutex.ts).

**Transaction + cap-5 prune idiom** (from `merge-dao.ts:98` `inWriteTransaction` usage; `?`-bound throughout):
```typescript
return inWriteTransaction(exec, async () => {
  const uid = newUid();
  await exec.runAsync(
    `INSERT INTO interaction_assists
       (uid, contact_id, channel, endpoint_value, status, handoff_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [uid, contactId, channel, endpointValue, now, now, now]);
  await exec.runAsync(
    `UPDATE interaction_assists SET status='expired', resolved_at=?, modified_at=?
      WHERE status='pending' AND id NOT IN (
        SELECT id FROM interaction_assists WHERE status='pending'
        ORDER BY created_at DESC, id DESC LIMIT 5)`,
    [now, now]);
  return uid;
});
```

**Read source:** `recency-dao.ts:1-243`, `merge-dao.ts:88-189` (both opened this session).

---

### `src/db/interaction-assist-read.ts` (DAO read — queue + route derivation)

**Analog:** `src/db/contact-methods-read.ts:7-40` (verified).

Route derivation reuses these two verbatim — do NOT reinvent actionable selection:
```typescript
// contact-methods-read.ts:30 — one actionable primary per type (stored primary wins if actionable)
listActionablePrimaryMethods(exec, contactId): Promise<{ phone: ContactMethodRow|null; email: ContactMethodRow|null }>
// contact-methods-read.ts:7 — all methods per type, ordered (endpoint selector when ≥2 actionable)
listContactMethodGroups(exec, contactId): Promise<{ phone: ContactMethodRow[]; email: ContactMethodRow[] }>
```
`is_actionable` is a single per-method boolean (phone/email-granular, not channel-granular) — any actionable phone backs BOTH Call and Text (Cluster A/D). The read DAO takes `exec: SqlExecutor` and is node-testable (contract shared by every DAO).

Eligibility query (pure wall-clock, no timer): `status='pending' AND (now - handoff_at) ≥ 15s AND (now - created_at) ≤ 24h`, newest-first.

---

### `src/services/reach-out/handoff.ts` (native OS handoff + failure detection)

**Analog:** `src/screens/ComposeScreen.tsx:436-458` (`onSend`, verified — SMS path, writes NO row).

Verified Compose SMS idiom (try / native call / catch → `Alert`, `finally` releases an in-flight latch):
```typescript
// ComposeScreen.tsx:445-457
try {
  await SMS.sendSMSAsync(phone, draft);   // Android → {result:'unknown'}; NOT a "sent" signal — write nothing
} catch (err) {
  Logger.error(LOG_SCOPE, "failed to open SMS composer", err);
  Alert.alert("Couldn't open your messages app", /* … */);
} finally { setSending(false); }
```

Phase-21 handoff generalizes this to three channels. Text reuses `SMS.sendSMSAsync`; Call/Email are greenfield core `Linking.openURL('tel:…' | 'mailto:…')`:
```typescript
try {
  if (channel === "text") await SMS.sendSMSAsync(endpoint, "");
  else await Linking.openURL(channel === "call" ? `tel:${endpoint}` : `mailto:${endpoint}`);
} catch (err) {
  await markAssistFailed(exec, uid, localDateTime());   // 'failed' — never a pending prompt (Cluster F)
  Alert.alert(/* per-channel copy — UI-SPEC Copywriting error rows */);
}
```
- **Do NOT gate on `Linking.canOpenURL`** for `tel:`/`mailto:` — Android 11+ returns false without `<queries>` manifest entries (false "unavailable"). try/`openURL`/catch is the pattern (`LinksEditor.tsx:79`, `FuelEditor.tsx:129`).
- **UI-SPEC error copy differs from Compose's shipped copy** — Compose says "Your message is ready to copy instead." (it has a Copy fallback); the Reach Out router has no copy fallback, so use the UI-SPEC strings ("No app on this device can send texts." etc.), NOT the Compose string verbatim.
- The assist row is written BEFORE this handoff runs (Cluster E). Assist ON only.

---

### `src/services/interaction-assist-sweep.ts` (launch-sweep prune hook)

**Analog:** `src/services/launch-sweep.ts:26-115` (verified).

Register ONE hook via `registerSweepHook(fn: () => Promise<void>)` (`launch-sweep.ts:45`). The sweep does: expire pending >24h → `'expired'`; DELETE resolved rows >30 days. Wall-clock deltas at sweep time — NEVER a `setTimeout`/timer (SQLite has no scheduler; a timer dies on process death and defeats Cluster Q durability).

**Load-bearing negative constraints from the analog:**
- Importing the sweep module must have NO module-scope side effect — a headless widget/notification tap loads the bundle but must never reach the sweep (`launch-sweep.ts:11-16`; `widget-task-handler.tsx:34-42`).
- The banner's AppState re-query (below) must be a SEPARATE subscription from `installSweepTrigger` — the sweep dedupes to once-per-launch (`installSweepTrigger:102-115`, tracks `previous`/`background→active`), whereas the banner refreshes on EVERY return.

---

### `src/stores/assist-store.ts` (Zustand banner queue + AppState)

**Analog:** `src/stores/dashboard-prefs-store.ts` (Zustand `create` shape, verified).

The five existing stores are all `create<T>()(persist(…, AsyncStorage))` UI-preference stores. **No existing store subscribes to AppState** — that part is new. Reuse only the `create<Store>()((set) => ({…}))` shape; do NOT use `persist`/AsyncStorage here (the durable queue lives in SQLite; the store holds only ephemeral banner state re-queried from SQLite on cold start and every `background→active`). Extract a PURE eligibility function (`≥15s`, `≤24h`, newest + count) so it is node-testable (`assist-store.test.ts`, Wave 0).

```typescript
// shape only — from dashboard-prefs-store.ts:25-32
import { create } from "zustand";
export const useAssistBanner = create<AssistBannerStore>()((set) => ({
  queue: [],
  refresh: async () => { /* query interaction-assist-read, set eligible newest-first */ },
}));
```

---

### `src/components/AssistBanner.tsx` (app-global non-modal overlay)

**Analog:** `src/components/BirthdayBanner.tsx:1-60` (verified — presentational, caller wires nav).

Reuse: `surface` bg + `border` card, `borderRadius` 12, `numberOfLines={1}` rows, 44px hit rows, async cancelled-flag read, renders `null` when empty, `onPress*` supplied by caller (stays presentational). Every colour via `useTheme().colors.*`.

**CRITICAL deviation from BirthdayBanner:** BirthdayBanner is dashboard-scoped (rendered inside the dashboard screen). AssistBanner must be an **absolutely-positioned overlay in the App shell above the navigator** — app-global (Cluster H). It MUST NOT be an RN `Modal` (a `Modal` captures Android Back; Cluster H requires Back to pass THROUGH the durable banner). Pitfall 4.

---

### `src/components/ReachOutRouter.tsx` + `EndpointSelector.tsx` (modal + endpoint sheet)

**Analog:** `src/components/OverflowMenu.tsx` (modal scrim + `surfaceElevated` sheet + `Pressable` rows); button emphasis trio from `ComposeScreen.tsx` `actionBtn` (filled-accent primary / accent-outline secondary / border-outline tertiary).

Router renders ONLY routes with an actionable method; hidden entirely when none (Cluster A — no empty modal). ≤3 taps: 1 endpoint → launch directly; ≥2 → EndpointSelector with primary emphasized ("Primary" chip). Accent reserved for the primary route button + primary endpoint + confirmation "Yes" only (UI-SPEC Color).

---

### `src/components/AssistConfirmation.tsx` (Yes / No answer / Don't log + Notes)

**Analog:** `src/screens/ComposeScreen.tsx` `aiPanel`/`aiPanelActions` (right-aligned action row + collapsible sub-section).

Call → "Yes" / "No answer" / "Don't log"; Text/Email → "Yes" / "Don't log". "Yes" filled accent; "No answer"/"Don't log" neutral border-outline (NOT accent, NOT danger). Notes expander ("Add a note", collapsed) offered on EVERY confirmation that writes a row — including Call "No answer" (Cluster K/T). "Don't log" → `status='dismissed'`, writes nothing.

---

## Modified-File Wiring (the cross-phase correctness risk)

### `src/db/database.ts` — migration registration
`TARGET_VERSION = 13` at `:48` (verified — NOT drifted; migrations run 001–013). Bump to `14`, add `migration014` import + append to `MIGRATIONS` array (`:51-65`). **Re-verify `TARGET_VERSION` on disk before writing — it drifts every schema phase (MEMORY: migration-005/006-renumber).**

### `src/db/migrations/014-interaction-assists.ts` — new table + column
**Analog:** `013-reconciliation-and-merge.ts:4-56` (table idiom) + `005-digest-settings.ts:38-49` (ALTER app_settings idiom, both verified).
- Migration signature is `async apply(exec: SqlExecutor, _deps: MigrationDeps)` — RESEARCH's example omitted `_deps`; match 013's real two-arg shape.
- Table needs `modified_at TEXT NOT NULL` — required by `mergeContacts` `reparent()` which does `SET contact_id=?, modified_at=?` (`merge-dao.ts:89`).
- `contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE` (purge removal).
- 005 ALTER idiom (verified `005:39-41`): `ALTER TABLE app_settings ADD COLUMN interaction_assist_enabled INTEGER NOT NULL DEFAULT 1;`

### `src/db/merge-dao.ts` — reparent array (Cluster AA, Pitfall 2)
Verified: line 153 reparents `["interactions","events","fuel","custom_field_values","contact_links","contact_methods","external_contact_links"]`. **Add `"interaction_assists"` to this array** or a pending assist is cascade-deleted when the absorbed contact is DELETEd (`merge-dao.ts:185`) and merge-redirect silently fails. `reparent()` (`:88-90`) sets `contact_id`+`modified_at` — hence the required `modified_at` column.

### `src/db/purge-dao.ts` — rely on cascade (Cluster AB, A4)
Verified: purge does an EXPLICIT fan-out over `PURGE_CHILDREN` (`:244`), deliberately NOT relying on FK cascade for auditability. Assists are operational state (not a tombstone/mergeable entity, Cluster X) → do NOT add them to `PURGE_CHILDREN`; rely on `contact_id … ON DELETE CASCADE` (the `DELETE FROM contacts` at `:261` removes them). **Add a purge-dao test asserting a pending assist is gone after purge** (the explicit-fan-out house style makes the cascade reliance worth a guarding test).

### `src/db/app-settings-dao.ts` — settings key
**Analog:** self, `updateAppSettingsCore` at `:617` (verified). Extend `COLUMN_OF`, the `AppSettings`/`AppSettingsPatch` types, and the `getAppSettings` SELECT (`:39-330`) with `interactionAssistEnabled` → `interaction_assist_enabled`. Toggle-OFF wraps `updateAppSettingsCore` + a pending-clear UPDATE in ONE `inWriteTransaction` ("off means off", Cluster G — normal `Switch`, no confirm dialog). `?`-bound; validation runs BEFORE the txn opens (`:601-603`).

### `src/navigation/widget-linking.ts` — new allow-list form (V5 security boundary)
**Analog:** self (verified `:83-158`). Add, mirroring `CONTACT_URI` (`:91`) exactly:
```typescript
const REACH_URI = /^orbit:\/\/reach\/([0-9]+)$/;
```
Reuse `parseWidgetId` (`:100-106`: `Number.isSafeInteger` + `id > 0`) — the URI is an untrusted launcher intent. Add a matching `WidgetNavIntent` variant (`:59-80`) resetting onto `[Home, Profile{contactId, openReachOut:true}]` (Open Question 1 recommendation) so Profile opens the router. **Keep the existing `COMPOSE_URI` route** (still used by notification tap, CMP-02); only the widget stops emitting it. Extend `widget-linking.test.ts` (accepts `orbit://reach/<id>`, rejects malformed/oversized).

### `src/services/widget/widget-render.tsx` — Message → Contact (Cluster AH)
**Analog:** self, verified LargeTile `ActionButton` at `:452-459`:
```tsx
<ActionButton glyph="✉" label="Message" glyphColor={palette.accent} palette={palette}
  clickAction="OPEN_URI" clickActionData={{ uri: `orbit://compose/${tile.id}` }} />
```
Swap to label `"Contact"` and `uri: \`orbit://reach/${tile.id}\``. Widget emits ONLY the URI; `widget-task-handler.tsx:78-83` writes nothing headless (verified). Small widget unchanged.

---

## Shared Patterns

### Authoritative interaction write
**Source:** `src/db/recency-dao.ts:217` (`recordTouchpoint`).
**Apply to:** every confirmation that logs (Call Yes, Call No answer, Text/Email Yes). Never a direct `interactions`/`last_contact` write.

### UUID minting
**Source:** `src/db/uid.ts:18` (`newUid()` — guards `globalThis.crypto?.randomUUID`, falls back to Math.random v4).
**Apply to:** every assist row `uid` and every interaction `uid`. NEVER `crypto.randomUUID()` directly (Hermes has no `globalThis.crypto`; tests pass in Node but it throws on the Pixel — MEMORY "Hermes crypto is undefined").

### Local timestamps
**Source:** `src/db/database.ts:74` (`localDateTime()`), `src/utils/dates.ts:17` (`formatLocalDate()`).
**Apply to:** `handoff_at`, `created_at`, `modified_at`, `resolved_at`, and the confirmation `occurredAt`/`now`. NEVER `toISOString()` (UTC evening off-by-one shifts the status day).

### Write transactions
**Source:** `src/db/transaction.ts` (`inWriteTransaction`), used verbatim in `merge-dao.ts:98`, `app-settings-dao.ts:604`.
**Apply to:** every multi-statement assist write (create-with-prune, resolve, toggle-off-clear). Never nest one inside `recordTouchpoint` (mutex → permanent hang).

### Theme colours
**Source:** `useTheme().colors.*` (`src/theme`). `src/theme/theme-presets.ts` is the ONLY file where a hex may appear.
**Apply to:** all four new components. `npm run check:colors` enforces it.

---

## No Analog Found

None. Every file maps to a verified on-disk analog. The two partial gaps (not "no analog"):

| Aspect | Gap | Planner guidance |
|--------|-----|------------------|
| `assist-store.ts` AppState subscription | No existing store subscribes to AppState; the 5 stores are AsyncStorage-persist UI prefs | Reuse Zustand `create` shape only; model the AppState transition on `installSweepTrigger:108-114` (background→active) but as a SEPARATE subscription |
| `AssistBanner.tsx` app-global mount | `BirthdayBanner` is dashboard-scoped, not shell-global | Reuse the card/read idiom; mount as an absolutely-positioned shell overlay above the navigator, NOT a `Modal` |

---

## Metadata

**Analog search scope:** `src/db/`, `src/db/migrations/`, `src/services/`, `src/services/widget/`, `src/stores/`, `src/components/`, `src/screens/`, `src/navigation/`.
**Files opened & verified this session:** `recency-dao.ts`, `merge-dao.ts`, `purge-dao.ts`, `database.ts`, `migrations/013`, `migrations/005`, `uid.ts`, `contact-methods-read.ts`, `app-settings-dao.ts`, `widget-linking.ts`, `launch-sweep.ts`, `ComposeScreen.tsx`, `widget-render.tsx`, `dashboard-prefs-store.ts`, `BirthdayBanner.tsx`.
**RESEARCH line-numbers that drifted:** none material — `TARGET_VERSION = 13` (`database.ts:48`) confirmed; merge reparent array confirmed at line 153; migration `apply` takes `(exec, deps)` (RESEARCH example dropped `deps`).
**Pattern extraction date:** 2026-08-31
