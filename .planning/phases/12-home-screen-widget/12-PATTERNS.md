# Phase 12: Home Screen Widget - Pattern Map

**Mapped:** 2026-08-17
**Files analyzed:** 12 (10 new, 2 modified)
**Analogs found:** 12 / 12 (all verified on disk)

> Every file:line and excerpt below was opened and verified against the actual
> code on disk this session. Two RESEARCH claims did NOT hold and are flagged
> inline (see **⚠ discrepancy** markers): `index.ts` is a bare
> `registerRootComponent` today (no Phase-10 share-intent registration), and
> `recordTouchpoint` wraps `inWriteTransaction`, not `withMutex` directly.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/widget/widget-task-handler.tsx` | headless task handler | event-driven | `src/services/notifications/notification-actions.ts` + `headless-task.ts` | role+flow exact |
| `src/services/widget/widget-photo.ts` | service (encoder) | transform / file-I/O | `src/services/photos/photo-pipeline.ts` | role+flow exact |
| `src/services/widget/widget-data.ts` | service (shaper) | CRUD (read) | `src/db/dashboard-read.ts` (`listDashboard`) | role-match |
| `src/services/widget/widget-colors.ts` | utility (theme resolve) | transform | `src/theme/theme-presets.ts` (`resolvePalette`) | role-match |
| `src/services/widget/widget-render.tsx` | component (RemoteViews) | transform | `src/components/ContactCard.tsx` (render contract) | partial (new primitives) |
| `src/services/widget/widget-refresh.ts` | service (freshness) | event-driven | `src/services/launch-sweep.ts` + `App.tsx:120-139` | role-match |
| widget-mark write path (inside handler) | DAO call | CRUD (write) | `src/db/recency-dao.ts` (`recordTouchpoint`) + `src/db/mutex.ts` | exact |
| `src/navigation/widget-linking.ts` | navigation bridge (pure resolver + gate) | event-driven | `src/services/notifications/notification-nav.ts` + `notification-gate.tsx` | role+flow exact |
| `src/theme/theme-types.ts` (MOD) | config (token contract) | — | existing `rogue` token, `theme-types.ts:66-75` | in-file extension |
| `src/theme/theme-presets.ts` (MOD) | config (colour literals) | — | existing `rogue: "#E0904A"`, `theme-presets.ts:54` | in-file extension |
| `src/components/ContactCard.tsx` (MOD) | component | — | itself — retire OD-1 placeholder (`ContactCard.tsx:102-116`) | in-file upgrade |
| Settings "Add widget" button (MOD `SettingsScreen.tsx`) | component (screen) | request-response | `SettingsScreen.tsx:212-220` Pressable pattern | role-match |
| `index.ts` (MOD) + `app.config.ts` (MOD) | config / entry | — | `app.config.ts:57-108` plugin builder; `index.ts` | in-file extension |

## Pattern Assignments

### `src/services/widget/widget-task-handler.tsx` (headless task handler, event-driven)

**Analog:** `src/services/notifications/notification-actions.ts` (the exactly-once
shared handler) + `src/services/notifications/headless-task.ts` (the module-scope
task definition/registration).

**Headless bootstrap-then-write (the H1 rule)** — `notification-actions.ts:114-160`:
```ts
// H2 layer 1: deterministic key + in-process short-circuit.
const key = actionUid(actionIdentifier, data);
if (handledSet.has(key)) { /* warm double-delivery ignored */ return; }

// H1: open + migrate the DB BEFORE getExecutor(). Idempotent on the foreground
// path (cached); the ONLY thing that opens the DB on a killed-app headless launch.
await openAndMigrate();
const exec = getExecutor();
const now = localDateTime();
try {
  await recordTouchpoint(exec, {
    contactId: data.contactId, uid: key, occurredAt: now, now,
    source: "notification", direction: "outbound", channel: "unspecified",
    connected: 1, quality: null,
  });
  ...
} catch (err) {
  if (isUniqueViolation(err)) { handledSet.add(key); /* benign replay */ return; }
  Logger.error(LOG_SOURCE, `action ${actionIdentifier} failed: ${key}`, err);
}
```
**Copy:** `openAndMigrate()` BEFORE `getExecutor()`; the exact touchpoint value set
(`source:"widget"`, `direction:"outbound"`, `channel:"unspecified"`, `connected:1`,
`quality:null`); the try/catch + `Logger.error` shape.
**Diverge (per RESEARCH Pattern 2 / Assumption A1):** mint the interaction `uid` with
`newUid()` (distinct rows per genuine tap — LOG-06), NOT the deterministic
`actionUid` collision-backstop, unless the Pixel spike shows `WIDGET_CLICK`
double-delivery. Do NOT copy `handledSet`/`isUniqueViolation` dedup by default.

**Module-scope task definition + registration** — `headless-task.ts:65-92`:
```ts
TaskManager.defineTask<HeadlessResponsePayload>(NOTIFICATION_ACTION_TASK,
  async ({ data, error }) => {
    if (error) { Logger.error(LOG_SOURCE, "headless task received an error", error); return; }
    try {
      ... await handleNotificationAction(notifData, actionIdentifier);
    } catch (err) { Logger.error(LOG_SOURCE, "headless task body failed", err); }
  });
```
The widget library registers its OWN headless entry via
`registerWidgetTaskHandler(widgetTaskHandler)` in `index.ts` (RESEARCH Pattern 1),
so you do NOT call `TaskManager.defineTask` yourself — but mirror the
**error-guard + try/catch-so-a-failure-never-crashes-the-headless-context** body
shape verbatim.

**Hard rule (verified):** the handler must import NOTHING that reaches
`runLaunchSweep`. See `launch-sweep.ts:10-14` — "Importing this module runs
NOTHING… a headless widget/notification tap… must never reach the sweep."

---

### widget-mark write (inside the handler) — DAO call (CRUD write)

**Analog:** `src/db/recency-dao.ts` `recordTouchpoint` + `src/db/mutex.ts`.

**⚠ discrepancy vs RESEARCH:** RESEARCH says `recordTouchpoint` "wraps its body in
`withMutex`". On disk (`recency-dao.ts:214-240`) `recordTouchpoint` wraps
`inWriteTransaction(exec, …)` and returns `{ interactionId }` — the `withMutex`
serialization lives inside `inWriteTransaction`, not as a visible call in
`recordTouchpoint`. Behaviourally the RESEARCH intent holds (one serialized write),
but do NOT expect a literal `withMutex(` in `recordTouchpoint`, and the return shape
is `{ interactionId }` (not `void`).

`recency-dao.ts:215-240`:
```ts
export function recordTouchpoint(exec, input): Promise<{ interactionId: number }> {
  try { rejectFutureOccurredAt(input.occurredAt, input.now); }
  catch (err) { return Promise.reject(err); }
  return inWriteTransaction(exec, async () => {
    const interactionId = await insertInteraction(exec, input.contactId, input.now, input);
    await recomputeLastContact(exec, input.contactId, input.now);
    return { interactionId };
  });
}
```
The shared serialization primitive — `mutex.ts:22-36`:
```ts
let chain: Promise<unknown> = Promise.resolve();
export function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn) as Promise<T>;
  chain = run.catch(() => {});
  return run;
}
```
The `mutex.ts:8-14` header comment already names "Phase-11/12 headless widget…
taps" as a shared caller. **Copy:** call `recordTouchpoint` — never a raw
`UPDATE last_contact`, never a nested `inWriteTransaction`, never a second mutex.

---

### `src/services/widget/widget-photo.ts` (encoder, transform / file-I/O)

**Analog:** `src/services/photos/photo-pipeline.ts` (`persistCroppedMaster`).

**Chainable ImageManipulator API (SDK 52+)** — `photo-pipeline.ts:27,85-92`:
```ts
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
...
const rendered = await ImageManipulator.manipulate(rawUri)
  .crop(cropRect)
  .resize({ width: MASTER_SIZE, height: MASTER_SIZE })
  .renderAsync();
out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: MASTER_COMPRESS });
```
**Copy:** the `.manipulate().resize().renderAsync()` → `.saveAsync()` chain and the
`SaveFormat.JPEG` + tunable-const pattern (`MASTER_SIZE`/`MASTER_COMPRESS` at file
top → widget uses `THUMB_PX`/`THUMB_Q`).
**Diverge:** the widget adds `base64: true` to `saveAsync` and returns
`data:image/jpeg;base64,${out.base64}` (a `data:` URI), NOT a persisted file path —
no `persistMaster`, no DB write (WDG-01: no new persistent state). Resolve the
master `file://` via `resolvePhotoUri(relativePath)` — `photo-storage.ts:130`.
Also reuse the `PhotoPipelineError`-style typed-error + `Logger.error(LOG_SCOPE, …)`
convention (`photo-pipeline.ts:49-54,93-95`).

---

### `src/services/widget/widget-data.ts` (tile shaper, CRUD read)

**Analog:** `src/db/dashboard-read.ts` `listDashboard`.

`listDashboard` signature + projection — `dashboard-read.ts:185-210`:
```ts
export function listDashboard(exec, opts: { filter; sort; term? }): Promise<DashboardRow[]>
// SELECT projects: id, name, photo, modified_at, categoryLabel, favourite_rank,
//   CARD_STATUS (progress + status, CASE-wrapped), fuelText, snippet
```
The favourites branch is already ordered `favourite_rank ASC` and reveals
never-contacted/snoozed favourites (`dashboard-read.ts:174-183` precedence comment).
**Copy:** call `listDashboard(exec, { filter: "favourites", sort })` — do NOT use the
leaner `FavouriteRow`/`listFavourites` (it lacks status+fuel; see `FavouriteRow`
shape at `dashboard-read.ts:96-103`). Never re-derive status (HIGH-1
never-contacted='stable' bug). The shaper maps `DashboardRow` → `WidgetTile`
(status, initials via `getInitials`/`swatchIndex`, thumb via `encodeWidgetThumb`),
and truncates beyond grid capacity by rank.

---

### `src/services/widget/widget-colors.ts` (theme resolver, transform)

**Analog:** `src/theme/theme-presets.ts` (`resolvePalette`, `DEFAULT_PRESET_ID`).

Verified on disk — `theme-presets.ts:18,65,96-100`:
```ts
export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = { "space-dark": { id: "space-dark", ... } };
export const DEFAULT_PRESET_ID: ThemePresetId = "space-dark";
export function resolvePalette(presetId, mode): ... {
  const preset = THEME_PRESETS[presetId] ?? THEME_PRESETS[DEFAULT_PRESET_ID]; ...
}
```
Only ONE preset (`space-dark`) ships today; light falls back to dark.
**Copy:** resolve the palette directly via `resolvePalette(DEFAULT_PRESET_ID, "dark")`
— NEVER `useTheme()` (no `ThemeProvider` is mounted in the headless render;
RESEARCH Pattern 4/Pitfall). The status→ring mapping (colour + weight for
stable/wobble/decay/rogue/null) is a pure table — mirror `ContactCard`'s
`statusLabel` switch shape (`ContactCard.tsx:73-86`) but return
`palette.statusStable|statusWobble|statusDecay|rogue`. `check:colors` allows hex
ONLY in `theme-presets.ts`, so passing a palette variable is compliant; never
inline a hex in the widget tree.

---

### `src/services/widget/widget-render.tsx` (RemoteViews component, transform)

**Analog:** `src/components/ContactCard.tsx` — for the CONTENT CONTRACT, not the
JSX primitives (it renders RN `View`/`Pressable`; the widget renders
`FlexWidget`/`ImageWidget`/`TextWidget`).

`ContactCard.tsx:118-214` shows the locked card contract: Avatar (photo or themed
initials fallback), status ring, one-line name, ranked fuel line, favourite marker.
The widget's small tile carries a subset (avatar + status ring + name/chevron); the
large tile adds action buttons + fuel line. **Copy:** the avatar-fallback rule
(`photo ? <img> : themed initials swatch`, `ContactCard.tsx:129-136` via
`<Avatar>`), which internally uses `swatchIndex(name)` + `avatarSwatches` +
`getInitials` — reuse those helpers rather than a second fallback scheme.
RESEARCH Code Examples §"Avatar tile with status ring" gives the concrete
`FlexWidget`/`ImageWidget` tree (clickAction `WIDGET_MARK` on the tile, `OPEN_URI`
`orbit://contact/${id}` on the name/chevron region).

---

### `src/services/widget/widget-refresh.ts` (freshness, event-driven)

**Analog:** `src/services/launch-sweep.ts` registry + `App.tsx:120-139`
one-shot registration guards.

`launch-sweep.ts:27,45-47`:
```ts
export type SweepHook = () => Promise<void>;
export function registerSweepHook(fn: SweepHook): void { hooks.push(fn); }
```
`App.tsx:120-139` — the once-only registration idiom (module-flag guard, register
BEFORE `installSweepTrigger` fires the cold-start sweep):
```ts
if (!notificationScheduleRegistered) {
  registerNotificationScheduleSweep(getExecutor);
  notificationScheduleRegistered = true;
}
```
**Copy:** wrap `requestWidgetUpdate({ widgetName, renderWidget, widgetNotFound })`
in `pushWidgetUpdate()`; register the foreground launch recompute ONCE via
`registerSweepHook(pushWidgetUpdate)` behind a module flag in `App.tsx`, alongside
the existing sweep registrations. The launch recompute is foreground-only by
construction (it fires from `installSweepTrigger`, `launch-sweep.ts:102-111`) — the
headless tap never reaches it. The `BOOT_COMPLETED` re-push is a SEPARATE native
receiver (config-plugin manifest), NOT a sweep hook.

---

### `src/navigation/widget-linking.ts` (deep-link bridge, event-driven)

**Analog:** `src/services/notifications/notification-nav.ts` (PURE resolver) +
`src/navigation/notification-gate.tsx` (`applyBodyNav` gate) +
`src/navigation/linking.ts` (`navigationRef` + ready-gated `ShareIntentGate`).

**Pure resolver → discriminated nav-intent** — `notification-nav.ts:27-80`:
```ts
export type NavIntent =
  | { type: "reset"; index: 1; routes: [{name:"Home"}, {name:"Compose"; params:{contactId:number}}] }
  | { type: "navigate"; name: "Profile"; params: { contactId: number } };
export function resolveNotificationNav(data: unknown): NavIntent | null {
  if (!isNotificationData(data)) return null;       // malformed → null (V5 input validation)
  if (data.kind === "decay") return { type:"reset", index:1, routes:[{name:"Home"},{name:"Compose",params:{contactId:data.contactId}}] };
  return { type:"navigate", name:"Profile", params:{contactId:data.contactId} };
}
```
**Applying the intent to the live navigator** — `notification-gate.tsx:82-96`:
```ts
function applyBodyNav(data) {
  const intent = resolveNotificationNav(data);
  if (!intent) return;
  const nav = navigationRef.current;
  if (!nav) return;
  if (intent.type === "reset") nav.reset({ index: intent.index, routes: intent.routes });
  else nav.navigate(intent.name, intent.params);
}
```
**Copy exactly:** a pure `resolveWidgetUri(url): WidgetNavIntent | null` (node-testable,
no RN/expo import — mirror `notification-nav.ts`'s "no react-navigation" rule) that
returns a `reset` onto `[Home, target]` so Back ALWAYS lands on the dashboard
(`TaskStackBuilder` does NOT compose with `singleTask`); a thin gate applies it via
`navigationRef.current`. Narrow untrusted OS input hard: `Number.isInteger` on
`contactId`, strict `orbit://contact/<int>` / `compose/<int>` / `favourites` parse,
null otherwise (mirrors `isNotificationData`, `notification-nav.ts:43-52`).

**Gate wiring** — `linking.ts:34,51-61` + `App.tsx:205-210`: reuse the SAME exported
`navigationRef`; mount a render-null gate keyed on the reactive `navReady` flag
(`App.tsx:92,205 onReady={() => setNavReady(true)}`), exactly like `ShareIntentGate`
and `NotificationResponseGate`. **⚠ Do NOT add a `linking` `getInitialURL`/`subscribe`
config** — `linking.ts:22-33` documents that a second consumer races the
share-intent singleton (Pitfall 4). Use `Linking.addEventListener('url', …)` +
`getInitialURL()` for `orbit://` only, and it must NOT touch the share `text/plain`
path (that stays `ShareIntentProvider`'s single-owner job).

---

### `src/theme/theme-types.ts` + `theme-presets.ts` (MOD — shared status tokens)

**Analog:** the existing `rogue` token — the exact same shape you are extending.

`theme-types.ts:66-75` declares `rogue: string;` with a doc-comment explaining it is
a status hue distinct from `danger`. `theme-presets.ts:54` seeds `rogue: "#E0904A"`.
**Copy:** add `statusStable`, `statusWobble`, `statusDecay` as `string` fields on the
`ThemePreset.colors` type next to `rogue` (`theme-types.ts:75`), each with a
doc-comment; seed the owner-approved hexes in EVERY preset's `colors` block — today
that is ONLY `space-dark` (`theme-presets.ts:18-65`; one preset exists). Owner-approved
values (RESEARCH: `statusStable #45B98A`, `statusWobble #E8C15C`, `statusDecay
#E56A52`, `rogue #E0904A` unchanged) — but final hues are proposed at UI-SPEC for
owner approval, so leave the literal choice to that step. `check:colors` allows hex
ONLY in `theme-presets.ts`.

Also mirror the ORDERED-ARRAY token pattern if a ring-weight ramp is tokenized —
see `avatarSwatches` (`theme-types.ts:58`) and `gravityTiers`
(`theme-presets.ts:59`, a 4-entry ordered ramp).

### `src/components/ContactCard.tsx` (MOD — retire the OD-1 placeholder)

**Analog:** itself. `ContactCard.tsx:102-116` is the opacity-only placeholder to
retire:
```ts
const ringColor = status === "rogue" ? colors.rogue : colors.textSecondary;
const ringOpacity = status === "rogue" ? 1 : status === "decay" ? 0.9
  : status === "wobble" ? 0.6 : status === "stable" ? 0.35 : 0.2;
```
**Change:** replace with the new tokens —
`status === "stable" ? colors.statusStable : "wobble" ? colors.statusWobble :
"decay" ? colors.statusDecay : "rogue" ? colors.rogue : colors.textSecondary`
(neutral for null). PRESERVE the `statusLabel()` accessibilityLabel
(`ContactCard.tsx:73-86,140`) — uiautomator UAT asserts the band by label, not
colour. Keep every colour resolving through `useTheme().colors.*`
(`ContactCard.tsx:100`) — this is the in-app path with a ThemeProvider, unlike the
widget render.

### Settings "Add Orbit widget" button (MOD `SettingsScreen.tsx`)

**Analog:** the existing Pressable row — `SettingsScreen.tsx:212-220`:
```tsx
<Pressable onPress={() => navigation.goBack()}
  style={[styles.backBtn, { borderColor: colors.border }]}>
  <Text style={{ color: colors.textSecondary }}>Back</Text>
</Pressable>
```
**Copy:** a themed `Pressable` (all colours via `useTheme().colors.*`,
`SettingsScreen.tsx:72` header) whose `onPress` calls
`requestPinWidget({ widgetName: "OrbitFavourites" })` and, on `false`/reject, shows
the fallback copy (RESEARCH: "Your launcher can't add it automatically…"). Match the
`styles.card`/`surface`/`border` section idiom used throughout the screen
(`SettingsScreen.tsx:241,271,291`).

### `index.ts` + `app.config.ts` (MOD — native enablement)

**⚠ discrepancy vs RESEARCH:** RESEARCH says `index.ts` "ALREADY has a custom entry
created in Phase 10 for share-intent — a TWO-LINE ADDITION". On disk `index.ts` is
the bare Expo default:
```ts
import { registerRootComponent } from "expo";
import App from "./App";
registerRootComponent(App);
```
It has NO share-intent registration. Adding `registerWidgetTaskHandler(widgetTaskHandler)`
is still a small addition, but `index.ts` is the vanilla template file, not a
pre-customized entry — plan accordingly.

**Analog for `app.config.ts`:** the dedupe-by-name plugin builder —
`app.config.ts:57-108`. The tuple-append idiom for `[name, options]` plugins that
cannot be Set-deduped (`expo-image-picker`, `expo-share-intent`):
```ts
const pluginName = (entry) => Array.isArray(entry) ? entry[0] : entry;
return [
  ...stringPlugins.filter(p => pluginName(p) !== "expo-image-picker" && pluginName(p) !== "expo-share-intent"),
  pickerPlugin, shareIntentPlugin,
];
```
**Copy:** append `['react-native-android-widget', widgetConfig]` as a TUPLE through
this SAME builder (add it to the name-filter + append list) — a bare string entry is
the 01-01 duplicate-plugin prebuild hazard. After prebuild on `droid`, assert the
regenerated manifest preserves `android:allowBackup="false"` (`app.config.ts:36`),
`orientation:"portrait"` (`:22`), `launchMode="singleTask"`, and every prior plugin
(Pitfall 6). The `orbit://` scheme already exists (`app.config.ts:20`).

## Shared Patterns

### Headless DB bootstrap (H1)
**Source:** `notification-actions.ts:121-125`
**Apply to:** every widget handler branch that touches SQLite (mark AND render read).
```ts
await openAndMigrate();   // idempotent; the ONLY DB open on a killed-app headless launch
const exec = getExecutor();  // THROWS if called before openAndMigrate()
```

### Single-writer mutexed mark
**Source:** `recency-dao.ts:215-240` + `mutex.ts:22-36`
**Apply to:** the `WIDGET_MARK` write. Call `recordTouchpoint`; never a raw UPDATE,
never a second mutex, never a nested transaction.

### Sweep-isolation (negative invariant)
**Source:** `launch-sweep.ts:10-14`
**Apply to:** the widget task handler — import nothing that reaches `runLaunchSweep`.
The launch recompute is a `registerSweepHook`, foreground-only.

### Pure resolver + thin gate (deep-link)
**Source:** `notification-nav.ts:27-80` + `notification-gate.tsx:82-96` + `linking.ts:34,51-61`
**Apply to:** `widget-linking.ts`. Node-testable pure `resolveWidgetUri`; reset onto
`[Home, target]`; apply via the shared `navigationRef` gated on `navReady`.

### Theme-token discipline
**Source:** `theme-presets.ts` (only colour-literal file) + `ContactCard.tsx:100`
**Apply to:** every new file. In-app (ContactCard, Settings) → `useTheme().colors.*`.
Headless (widget render) → `resolvePalette(DEFAULT_PRESET_ID, "dark")`. Never a hex
literal outside `theme-presets.ts`.

### Tunable-constants-at-file-top
**Source:** `photo-pipeline.ts:38-42` (`MASTER_SIZE`, `MASTER_COMPRESS`)
**Apply to:** `widget-photo.ts` (`THUMB_PX`, `THUMB_Q`), grid geometry consts —
per CLAUDE.md "tuning is a single-number edit."

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `BOOT_COMPLETED` native receiver | native / OS receiver | event-driven | No existing native manifest receiver in this Expo-managed project; first committed native change. Wiring is device/prebuild work (RESEARCH Open Q2 / A4) — resolve during native enablement on `droid`. |
| `widget-render.tsx` RemoteViews tree (JSX primitives) | component | transform | `FlexWidget`/`ImageWidget`/`TextWidget` have no in-repo analog (net-new library). Use RESEARCH Code Examples for the primitive tree; `ContactCard` supplies only the content contract. |

## Metadata

**Analog search scope:** `src/services/notifications/`, `src/db/`, `src/services/photos/`,
`src/theme/`, `src/components/`, `src/navigation/`, `src/services/launch-sweep.ts`,
`App.tsx`, `index.ts`, `app.config.ts`, `src/screens/SettingsScreen.tsx`.
**Files opened & verified this session:** notification-actions.ts, headless-task.ts,
recency-dao.ts, mutex.ts, notification-nav.ts, notification-gate.tsx, linking.ts,
dashboard-read.ts, photo-pipeline.ts, theme-types.ts, theme-presets.ts, ContactCard.tsx,
launch-sweep.ts, App.tsx, index.ts, app.config.ts, SettingsScreen.tsx.
**Pattern extraction date:** 2026-08-17
</content>
</invoke>
