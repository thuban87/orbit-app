# Dossier 12 — `widget` — Home screen widget

> **Status: complete.** 9 questions over 3 rounds; no `[OPEN]` items. All recommendations were
> taken; no upstream `[DECIDED]`/`[REJECTED]` item was reversed (the §6 long-press mechanism
> change is flagged in Cluster B as a mechanism, not an intent, reversal).

## Scope

The Android home-screen widget: a grid of favourite contacts rendered as `RemoteViews` via
`react-native-android-widget` (custom dev client / prebuild — **not** Expo Go). This domain
decides only what upstream domains left open: the exact preset action set (HANDOFF §12.3
open-question #3 / §6 `[OPEN]`), the grid size and how favourites are selected/ordered onto the
tile, whether status is encoded on the widget at all, staleness/update cadence, and whether the
"widget swaps itself into a profile view" stretch goal is in or out of v1.

It does **not** re-decide: that the widget is a favourites grid (HANDOFF §6 `[DECIDED]`), that
tap = mark-contacted and long-press = deep-link (§6 + 04-log), that fuel appears only on the
larger size (03-fuel, owner-chosen), that photos ship as base64 (07-photos), that favourites are
marked/ordered on the shared "Manage favourites" screen (08-dashboard), or the app-wide
`singleTask` / `onNewIntent` / "Back → dashboard" back-stack model (10-capture, 11-notify).

## Inherited constraints (decided upstream — NOT reopened here)

- **[from data]** Favourites = a nullable **rank column** on `contacts`; tiles hold rank order. A
  widget tap **writes a full interaction row**, not just a date. (01-data E, `[data → widget]`)
- **[from fuel]** Fuel renders **only at the larger widget size**; small tiles stay a clean grid.
  **No privacy control governs home-screen exposure** — fuel on the widget is visible to anyone
  glancing at the phone; the owner accepted this cost explicitly. Two layouts to maintain.
  (03-fuel, owner decision `[fuel → widget]`)
- **[from log]** Small tiles keep §6 exactly: **tap = quick mark, long-press = deep-link to
  profile**. The **larger** tile shows **Quick mark** + **Log contact** as two visible buttons.
  Widget taps are **headless broadcasts, ~30 s budget**. ⚠ **Android 15+ force-stop greys the
  widget** until next app launch — the widget can **never** be the only route into the log.
  A quick mark writes `channel='unspecified'`, `connected=true`, `direction='outbound'`,
  `quality=null`, `source='widget'`. **No undo** on a widget tap (process freezes ~10 s after
  backgrounding). (04-log)
- **[from photos]** Widget images **must be base64 `data:` URIs** (RemoteViews can't read
  `file://`), re-encoded from the 512px master, within RemoteViews byte/Binder ceilings. Missing
  photo → **themed swatch + initials**, deterministic per contact. (07-photos `[photos → widget]`)
- **[from crud/dashboard]** Favourites are **marked** with a star on the profile and **ordered**
  by drag on a **net-new "Manage favourites" screen shared with the widget config**. (06-crud D,
  08-dashboard D)
- **[from capture/notify]** `launchMode="singleTask"` is imposed **app-wide**; widget taps reuse
  one activity via **`onNewIntent`**, not `onCreate`. Post-tap back-stack inherits the **"Back →
  dashboard"** pattern; concrete `onNewIntent` routing + synthetic back-stack is a phase-planning
  item under Android 15 background-activity-launch limits. (10-capture, 11-notify)

## Decisions

<!-- [DECIDED]/[OPEN]/[REJECTED], grouped by cluster. Appended after each round. -->

### Cluster A — What the tile shows

- **[DECIDED] Each favourite's avatar carries its status colour** (stable / wobble / decay /
  `rogue`), so overdue-ness is glanceable from the home screen. This is the widget's answer to
  "grid of favourites" (§6) with the decay core loop made visible. Consequence: the widget must
  **re-render when a contact's status changes** (feeds the freshness model, Cluster E), and the
  status-colour + `rogue` tokens (09-orrery) must be baked into the RemoteViews bitmap.
  **[REJECTED] Plain grid, no status** (gives up the glance value the product is built on);
  **[REJECTED] binary due-badge only** (owner chose the full status palette).
- **[DECIDED] Favourites render in static manual rank** — the drag order set on the shared
  "Manage favourites" screen (08-dashboard). Fixed positions = muscle memory, and stable
  positions matter because the mark-contacted tap has **no undo** (04-log). The grid is a
  dependable shortcut board, not a reordering feed.
  **[REJECTED] Status-weighted "overdue first" ordering** — would make positions jump under the
  thumb as days pass, raising mis-tap risk on the un-undoable action, and drifts the widget from
  "favourites" toward a "who needs you now" board (which would edge into reopening §6). Status is
  *shown* (colour) but never *reorders* the grid.
- **[DECIDED] Target ~6 favourites at the default size; the larger size fits more; extras beyond
  capacity truncate by rank.** Matches the ~7–8 active-contact working set (HANDOFF §10). The
  exact max at each resolution is a **device-spike / planning** check (baked-bitmap grid, bitmap
  memory ceiling is real but unquantified — see Findings).
  **[REJECTED] ~4 big** and **[REJECTED] ~9+ dense** as the default.

### Cluster B — What the tile does (the action set — closes HANDOFF §12.3 open-question #3)

- **[DECIDED] The widget offers a direct MESSAGE action, on the larger tile only.** It
  deep-links to the **same in-app compose screen the decay notification opens** (11-notify), so
  the person's fuel is visible and the flow is consistent across surfaces. The small tile stays a
  clean one-tap-mark grid. Rationale: the product's actual goal is *sending*, not just logging —
  the widget should provide a path to it, but not at the cost of the small tile's simplicity.
  **[REJECTED] Message primary on all sizes** (⚠ would have reshaped 04-log's decided small-tile
  one-tap = mark); **[REJECTED] no message action at all** (leaves the widget able to log a
  contact but never help make one).
- **[DECIDED] The larger tile's action set is therefore: Quick mark · Log contact · Message**
  (04-log's two buttons + the new Message), plus the per-contact fuel line (03-fuel). The small
  tile carries only the tap-to-mark grid.
- **[DECIDED] ⚠ HANDOFF §6's "long-press = deep-link" is not buildable as a literal long-press** —
  RemoteViews taps are single clicks (verified, `platform-library.md` Q4). The **deep-link intent
  survives**; the mechanism becomes **two separate tap regions per tile**. On the **small tile**:
  the **whole tile/avatar = mark-contacted** (biggest hit-area for the most-fired, no-undo
  action) and a **small explicit affordance — the name label / a chevron = open profile**. The
  larger tile exposes profile via its labelled-button layout. This is a **mechanism change, not a
  reversal of §6's intent** — flagged per the decision-reversal rule because §6 recorded
  "long-press" specifically.
  **[REJECTED] Avatar=mark / name-half=profile** (too much of the tile opens the profile instead
  of marking); **[REJECTED] tap=profile / explicit ✓=mark** (safer against mis-marks but adds a
  tap to the one action §6 wants cheapest).

### Cluster C — The self-swap-into-profile stretch goal

- **[DECIDED] Out of v1.** The tile already deep-links to the real, full in-app profile screen,
  which is richer than a re-rasterised baked-bitmap mini-profile. Self-swap is *feasible*
  (`platform-library.md` §6-stretch) but costs per-`widgetId` mode persistence, a re-rasterise on
  every flip, and a rule that every app-driven refresh must respect the stored mode — poor
  value/complexity ratio against a deep-link that's already better. Revisit post-v1.
  **[REJECTED] In as time-permitting** and **[REJECTED] In, committed** for v1.

### Cluster D — Configuration & instances

- **[DECIDED] Global mirror, no config screen.** The widget always shows the single shared
  favourites list (marked/ordered on the "Manage favourites" screen, 08-dashboard). No
  per-instance selection, no config Activity, **no per-`widgetId` persisted state**. If the user
  places multiple widgets they all show the same list. Simplest model, matches the one-list
  design.
  **[REJECTED] Per-instance config screen** (own set per widget — real extra build: config
  Activity + per-id state); **[REJECTED] global-now/per-instance-later** as a v1 commitment
  (kept only as the future note below).
- **[DECIDED] An in-app "Add Orbit widget" button** uses `requestPinWidget` (library 0.22.0),
  **degrading gracefully** to the OS widget picker / instructions on launchers that refuse it.

### Cluster E — Freshness / staleness

- **[DECIDED] Event-push + refresh on launch; no polling.** Re-render the widget on app events
  (open, edit, favourite change, mark-contacted) via `requestWidgetUpdate`, recompute status at
  each app launch, and re-push after boot / force-stop recovery. `updatePeriodMillis = 0`.
  **Accepted, stated plainly:** because a widget cannot run timers, the shown status is
  as-of-last-render — between app opens a tile can lag reality by up to ~a day of decay. This is
  fine: decay is measured in days, and the widget is a glance aid, **never the sole route**
  (Android 15 force-stop greying already guarantees that, `platform-android.md` Q1).
  **[REJECTED] Periodic 30-min auto-refresh** (battery cost, Doze-throttled, marginal gain);
  **[REJECTED] event-push + once-daily rollover** (offline background wake is unreliable —
  background tasks are network-gated per 11-notify — so "daily" isn't guaranteed).

### Cluster F — Empty state

- **[DECIDED] A "Choose favourites" prompt tile** that deep-links to the Manage-favourites
  screen. An empty widget becomes onboarding for the feature it depends on.
  **[REJECTED] Generic Orbit branding** (inert); **[REJECTED] fall back to most-overdue** (blurs
  "favourites" into "overdue" and needs never-empty query logic even at zero contacts).

## Cross-domain constraints exported

- **[widget → data / backup (15)]** The widget adds **no new persistent state and no new schema**:
  global-mirror + no self-swap + no per-instance config means favourites rank (01-data E), derived
  status, fuel rows (03-fuel) and the photo path (07-photos) are all that it reads, and they
  already exist. **Backup/restore need nothing widget-specific** — recorded so 15-backup does not
  hunt for widget state.
- **[widget → log (04)]** The small-tile tap and the larger tile's **Quick mark** write the exact
  interaction row 04-log defined for `source='widget'` (`channel='unspecified'`, `connected=true`,
  `direction='outbound'`, `quality=null`) through the single-writer DAO + JS mutex, inside the
  hardcoded **30 s** headless budget. **Log contact** (larger tile) deep-links into the full log
  flow.
- **[widget → notify (11) / capture (10)]** Widget taps share the app-wide
  `singleTask`/`onNewIntent` back-stack. ⚠ **Concrete refinement:** "Back → dashboard" must be
  built in **JS navigation (React Navigation)** — native `TaskStackBuilder` does **not** compose
  with `singleTask` + `onNewIntent` (`platform-android.md` Q3). This sharpens 11-notify's exported
  "Back → dashboard" pattern into its mechanism.
- **[widget → photos (07)]** The tile uses **base64 `data:` thumbnails pre-scaled below the 512px
  master** (grid-thumb size), never the full master and never `http(s)` sources (network on the
  widget thread + violates local-first). The safe favourites-count at a given resolution is a
  **device spike** — the RemoteViews bitmap-memory ceiling is real but unquantified in official
  docs (`platform-android.md` Q6, `platform-library.md` flags).
- **[widget → notify (11)]** The larger tile's **Message** action deep-links to the **same in-app
  compose screen the decay notification opens** — one compose surface, fuel visible, no second
  design.
- **[widget → dashboard (08) / profile]** The widget reads the shared "Manage favourites" screen
  (co-owned 08/12) and deep-links the profile affordance to the (still index-unowned) profile
  screen. No new ownership created here; reaffirms those gaps.
- **[widget → INDEX]** No new screen is introduced by this domain (Message reuses 11's compose;
  profile reuses the unowned profile screen). The only net-new UI surfaces are the **widget layouts
  themselves** and the **in-app "Add widget" button**, which needs a home in settings/onboarding.

## Deferred to phase discussion

- The **space-theme visual styling** of the widget — planet-style avatars, how the status ring is
  drawn on the tile, and the larger tile's layout of the fuel line + three buttons. This is HANDOFF
  §12.4 territory (owner designs the card/grid look directly with an agent).
- The exact **small-tile profile affordance** (tap the name label vs a chevron/icon) — a design
  detail with owner-visible mis-tap implications on the no-undo mark action.
- Larger-tile **button copy and iconography** (Quick mark / Log contact / Message).

## Deferred to phase planning

- **Grid geometry per size bucket** and the **max favourites per resolution** — device spike on the
  physical Pixel 6 Pro (baked-bitmap grid; bitmap-memory ceiling unquantified). Emulator cannot
  assess this box (CLAUDE.md).
- The **base64 thumbnail pipeline**: downscale the 512px master to tile-thumb size before encoding;
  validate within RemoteViews memory; round via `ImageWidget` `radius`.
- **One resizable widget** that re-renders small vs large on the `WIDGET_RESIZED` headless task
  (`widgetInfo.width/height` in dp) — vs declaring two picker entries. Resize-adapt is the library's
  intended path and is cheaper; confirm at build.
- **Freshness wiring:** `requestWidgetUpdate` on app events; recompute at launch; **re-push on
  `ACTION_BOOT_COMPLETED` and app launch** to recover from Android 15 force-stop greying;
  `updatePeriodMillis = 0`.
- The **two-tap-region hit-target construction** (whole-tile `clickAction` = headless mark vs a
  name-region `OPEN_URI` = profile deep-link) and the **JS synthetic back-stack** ("Back →
  dashboard") via React Navigation.
- The headless **`WIDGET_CLICK` mark write** reuses 04-log's single-writer DAO + JS mutex and must
  fit the 30 s budget; launch sweeps must **not** run on a widget-tap headless context (04-log's
  module-scope gating note).
- **`requestPinWidget`** "Add widget" button with graceful fallback (returns false on unsupported
  launchers / API < 26).

## Decisions made without you

Orchestrator's picks with no articulable divergence. **Read each as the decision AS ADOPTED.**
Veto any cheaply at review.

1. **The Message action deep-links to the same in-app compose screen the decay notification opens**
   (11-notify), not the OS SMS app directly — one compose surface, keeps fuel visible.
2. **One resizable widget** (re-render on `WIDGET_RESIZED`), not two separate launcher-picker
   entries — cheaper and is what the library is built for. The design pass may split it if wanted.
3. **`http(s)` image sources are never used** for contact photos — base64 `data:` only (network on
   the widget thread + violates the local-first read-path rule).
4. **The widget introduces no new persistent state / no new migration** — favourites rank, status,
   fuel and photo path already exist; global-mirror + no-self-swap + no-config guarantees this.
5. **The small-tile tap writes 04-log's exact `source='widget'` row** — no new write semantics
   invented here.

## Findings

<!-- [widget → other] entries. -->

## Deferred to phase discussion

## Deferred to phase planning

## Decisions made without you

## Findings

Investigation 2026-08-14. The widget has **no plugin predecessor** (Obsidian had no widgets), so
there is no source to port — investigation is entirely (a) the inbound cross-domain constraints
above, read first-hand from the completed dossiers, and (b) platform verification. Two verifiers
produced `workpapers/12-widget/platform-library.md` (`react-native-android-widget@0.22.0`, unpacked
from npm and read on disk) and `workpapers/12-widget/platform-android.md` (current
`developer.android.com`). **Every load-bearing claim below was confirmed first-hand** against the
cited workpaper before a decision was built on it.

**The architecture fact that colours everything (`platform-library.md`, Architecture):** the
library does **not** show live RemoteViews of your components — it renders the tree off-screen,
rasterises it to **one PNG on disk**, and displays it via a `ContentProvider` `content://` URI, with
transparent tap-rectangles overlaid (`RNWidget.java:76-121`). Consequences that drove decisions:
- **No text input, ever** (matches CLAUDE.md), and **no real long-press** — a tap is a single click
  (`platform-library.md` Q4). This is why §6's long-press became two tap regions (Cluster B).
- The ~1 MB RemoteViews Binder bitmap cap is **side-stepped** for the main image (served from disk),
  so a dense photo grid is **memory-/30 s-timeout-bound, not Binder-bound** — but the exact ceiling
  is **unquantified in official docs** (`platform-android.md` Q6), hence the device spike.

**Confirmed capabilities the design relies on:**
- **Small↔large split is real:** resize fires a `WIDGET_RESIZED` headless task carrying
  `widgetInfo.width/height`; the handler renders a different tree (`RNWidgetProvider.java:19-28`).
- **Tap = headless mark-contacted:** non-reserved `clickAction` → `WIDGET_CLICK` headless task,
  **30 000 ms hardcoded budget** (`RNWidgetBackgroundTaskWorker.java:34`) — enough for one SQLite
  write. Deep-link = reserved **`OPEN_URI`** (`orbit://contact/123`) → native `ACTION_VIEW`.
- **base64 `data:` photos** decode natively with `radius` for round avatars (`ResourceUtils.java:39-42`).
- **Config Activity, multiple instances (keyed by `widgetId`), and `requestPinWidget`** all
  supported; per-instance state is **yours to persist** (we chose not to — global mirror).
- **Self-swap is mechanically possible** (`renderWidget()` for a `widgetId` after JS runs) but
  carries the mode-persistence + re-rasterise caveats that made it a v1 cut.

**Platform constraints that bound the design (`platform-android.md`):**
- **Q1 — Android 15 force-stop greys widgets and cancels their PendingIntents** until the app is
  manually launched (`about/versions/15/behavior-changes-all`). The widget can never be the sole
  route; the app must **re-push on launch / `BOOT_COMPLETED`**.
- **Q2 — widget click and notification tap are explicit BAL exceptions** — both Orbit launch paths
  are allowed (`guide/components/activities/background-starts`).
- **Q3 — `TaskStackBuilder` does not compose with app-wide `singleTask`+`onNewIntent`** → "Back →
  dashboard" is a **JS-navigation** concern (`notifications/navigation`).
- **Q10 — `updatePeriodMillis` floors at 30 min and is Doze-throttled** → push on data change, never
  poll.

**Flagged (could not quantify / needs device work):** the RemoteViews bitmap-memory ceiling (real
but not in official docs — spike the favourites-count on the physical Pixel; the emulator can't run
on this box and perf claims are invalid there anyway); the library's coverage of the platform
collection/headless-broadcast paths was verified at the library level for the paths we use, not
exhaustively. `ListWidget` scrollable collections are capped at **2 per widget**
(`RNWidgetCollectionService.java:24`) — irrelevant to the chosen non-scrolling baked-bitmap grid.
