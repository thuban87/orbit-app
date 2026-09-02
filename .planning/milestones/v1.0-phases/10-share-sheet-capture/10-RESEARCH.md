# Phase 10: Share-Sheet Capture — Research

**Researched:** 2026-08-16
**Domain:** Android `text/plain` share-target capture (`expo-share-intent`, Expo SDK 57) → Conversational Fuel on a picked/inline-created contact
**Confidence:** HIGH — native facts were tarball-verified in the dossier workpapers (actual Kotlin/JS source of `expo-share-intent@8.0.1`) and re-verified against the live npm registry today; every reused code path (`fuel-dao`, `contacts-dao`, `transaction`, `dashboard-read`, `launch-sweep`, `App.tsx` boot) was read on disk; Android behaviour is cited to developer.android.com.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (grey areas resolved 2026-08-16 + inherited-binding)

- **Multi-select visual:** long-press enters multi-select; **corner checkmark badge** on each selected face + a persistent **"Done · N"** bottom bar committing **N independent fuel rows**. Single tap outside multi-select commits to exactly one contact and closes.
- **Note + title composition:** display text = **note, then `" — "`, then the shared title** ("note leads, title appended"). Both survive; row stays editable. The canonical `url` column is **never** overwritten by user prose (F-CAP-6/F-CAP-15). Note-only → note; title-only → title; bare-URL fallback when no `EXTRA_SUBJECT`.
- **Confirmation toast:** brief **"Saved to {name}"** (~1.5s), then `finish()` back to source. No Undo in v1. Multi: "Saved to N contacts".
- **Empty/near-empty picker:** always-present **"＋ New contact" tile** (the effective only path at 0–1 contacts). After a **name-only** inline create, write the fuel row and **return to source** — detail refined later on the profile, NOT via an "add detail now?" prompt.
- **Library = `expo-share-intent`**, config-plugin registration to `.MainActivity`, **patched to read `EXTRA_SUBJECT`** (it reads `EXTRA_TITLE`; Chrome puts the page title in `EXTRA_SUBJECT`). Bare-URL fallback still required.
- **Intent filter registers `text/plain` ONLY** — not `text/*`, not `image/*`. Owner accepts Orbit silently not appearing for `text/html`-only sources.
- **Write the fuel row the moment a contact is picked**, before any note prompt (`resetOnBackground: true` kills an unsaved payload on background). Payload durability is load-bearing.
- **Default kind = `topic`, `source='share'`.** Fuel rows carry `url`, `created_at`, `kind`, `source` from migration 1.
- **Payload → row mapping split:** bare URL → `url`=URL, display=`EXTRA_SUBJECT`-or-bare-URL; plain text → display=text, `url`=null; prose-with-URL → display=prose, `url`=first `http…` match.
- **Picker MUST NOT inherit `WHERE last_contact IS NOT NULL`.** Includes never-contacted, excludes archived, orders **favourites → capture-MRU → rest**. Capture-MRU derived from existing `fuel.created_at` + `contact_id` (no new column). Keyboard closed; search is a demoted tap-to-reveal affordance.
- **Contact pick is an in-app SQLite-backed screen**, never a system picker. No Direct Share targets in v1.
- **Capture is NEVER a touchpoint** — no `last_contact` write, no interaction row, not even opt-in. Writes go through the **fuel writer**, never the `last_contact` single-writer DAO.
- **Multi-attach writes N independent fuel rows** (not a join table).
- **Inline-create is name-only**, `last_contact` NULL (never-contacted). Fuel `contact_id` is NOT NULL — no capture inbox, ever.
- **Return uses plain `finish()`, never `finishAndRemoveTask()`.**
- **`launchMode="singleTask"` imposed app-wide** by `expo-share-intent` — a side effect Phases 11/12 inherit (recorded, not built here).

### Claude's Discretion (planner decides)
- `EXTRA_SUBJECT` patch mechanism (patch-package vs config-plugin mod) — **resolved below (Q1)**.
- Whether the picker may query `contacts` before launch-time sweeps complete (F-CAP-10) — **resolved below (Q4)**.
- Multi-attach transaction shape — **resolved below (Q5)**.
- Exact multi-confirmation copy; face-tile column count (3 in portrait per UI-SPEC, layout tunable).

### Deferred Ideas (OUT OF SCOPE — do NOT build)
- Direct Share / Android Sharing Shortcuts (native cost + data-leaves-device + decayed-contact suppression — REJECTED for v1).
- Capture inbox / nullable `contact_id` (REJECTED — not retrofittable).
- `ACTION_SEND_MULTIPLE`, `ACTION_PROCESS_TEXT`, clipboard capture (future surfaces).
- Opt-in "and mark contacted" (declined for v1).
- `image/*` capture, network fetch of page titles (REJECTED).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAP-01 | Register as Android `text/plain` share target; sharing opens the in-app grid-of-faces picker (favourites → capture-MRU → rest, keyboard closed, includes never-contacted, excludes archived) | Q2 (filter shape), Q4 (cold-start read safety), new `capture-read.ts` (favourites/MRU query, §Architecture), `dashboard-read.listFavourites` reuse |
| CAP-02 | Picking writes the fuel row immediately (kind `topic`, `source='share'`), optional skippable note edits display text while `url` stays canonical; single tap commits, long-press multi-selects; never marks contacted | `fuel-dao.addFuelCore`/`addFuel` reuse (§Don't Hand-Roll), Q5 (multi-attach one-transaction), Q6 (payload/note composition), capture-is-not-a-touchpoint invariant |
| CAP-03 | Shared links labelled from `EXTRA_SUBJECT` (patched library) with bare-URL fallback; prose-with-URL stores both | Q1 (patch mechanism), Q6 (payload mapping), FINDING A |
| CAP-04 | Inline-create name-only contact during capture (lands never-contacted); after saving, toast shows and Orbit returns to source | `contacts-dao.createContactFull` name-only path reuse, Q3 (finish()/return-to-source + the missing finish API), Q6 |
</phase_requirements>

## Summary

This phase is exceptionally well pre-researched: the dossier workpapers (`platform-share-intent.md`, `overlap-capture.md`, `platform-refresh.md`) read the **actual Kotlin and JS source of `expo-share-intent@8.0.1` from the npm tarball** and cite every Android behaviour to developer.android.com. This research re-verified the version against the live registry (still `8.0.1`, `time.modified` 2026-07-10, unchanged; pinned `expo: ^57`) and read every reused code path on disk. **No design decision changed.** The work is mechanics + flow composition over settled foundations, not new architecture.

Three facts dominate the plan. (1) `expo-share-intent` reads `Intent.EXTRA_TITLE`, **never** `EXTRA_SUBJECT` — Chrome puts the page title in `EXTRA_SUBJECT`, so a Chrome link arrives **unlabelled** unless the ~380-line Kotlin module is patched natively; a JS-only fix is impossible because the extra never reaches JS. (2) The library imposes `launchMode="singleTask"` app-wide and defaults `useShareIntent({ resetOnBackground: true })`, so the pick step **must** be an in-app SQLite screen and the fuel row **must** be written the instant a contact is picked. (3) The library provides **no** finish/return-to-source API, so the "toast → return to source" flow (CAP-04) needs an explicit `Activity.finish()` mechanism the plan must supply.

**Primary recommendation:** Install `expo-share-intent@8.0.1` via `npx expo install`, register `["expo-share-intent", { "androidIntentFilters": ["text/plain"] }]` (plus a `scheme`) in `app.config.ts`, apply a **patch-package** diff adding an `EXTRA_SUBJECT` fallback to the Kotlin module, add a **~10-line local native `finish()`** bridge (do not trust `BackHandler.exitApp()` semantics), put all payload-parsing/display-text logic in a node-tested `capture-logic.ts`, add a node-tested `capture-read.ts` for the favourites→MRU→rest picker query, and write multi-attach as **N `addFuelCore` calls inside ONE `inWriteTransaction`** — never nesting the non-reentrant mutex. All UAT is on the physical Pixel via `expo prebuild --clean` + release APK (a native module + manifest change is invisible to a Metro reload).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Share-target registration (intent filter, `singleTask`) | Android manifest (config plugin) | Build/prebuild | Declarative manifest; lands on `.MainActivity` via the plugin |
| `EXTRA_SUBJECT` extraction | Native (patched Kotlin module) | — | The extra never reaches JS; must be read in Kotlin |
| Payload delivery to JS (cold/warm) | Native module → `useShareIntent` hook | — | Library stashes the intent pre-JS on cold start |
| Payload → display-text/url mapping | Pure logic (`capture-logic.ts`, node-tested) | — | Correctness-critical, react-native-free, Vitest |
| Contact picker query (favs → MRU → rest) | DB read (`capture-read.ts`, node-tested) | — | Local SQLite only; never a network read path |
| Fuel write (single + multi-attach) | DB write (`fuel-dao` cores in `inWriteTransaction`) | — | Reuse the fuel writer; NEVER the `last_contact` DAO |
| Inline name-only create | DB write (`contacts-dao.createContactFull`) | — | Existing name-only path; lands never-contacted |
| Picker / note / confirmation UI | RN screen (`src/screens/`) | — | Pixel-UAT `.tsx`; grid `FlatList`, `Avatar` verbatim |
| Return to source app | Native (`Activity.finish()` bridge) | — | Library provides no finish API |

## Resolved Planning Questions (the 6 required answers)

### Q1 — `EXTRA_SUBJECT` patch mechanism: **use `patch-package`** (a native Kotlin diff), not a config-plugin mod

**Why a native patch at all is unavoidable:** `ExpoShareIntentModule.kt` reads `intent.getCharSequenceExtra(Intent.EXTRA_TITLE)` (line 132) and `grep EXTRA_SUBJECT` over the whole shipped Android source returns **nothing** `[VERIFIED: tarball read, dossier platform-refresh.md + re-confirmed npm 8.0.1 today]`. The JS layer is a straight pass-through (`meta: { title: shareIntent.meta?.title }`), so `EXTRA_SUBJECT` **never reaches JS** — a JS-only fallback is impossible. CAP-03 requires the title, so the native read must be added.

**Recommended mechanism — `patch-package`:**
- Add `patch-package` as a devDependency and a `"postinstall": "patch-package"` script. Commit the generated `patches/expo-share-intent+8.0.1.patch`.
- The one-line change: `"title" to (intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: intent.getCharSequenceExtra(Intent.EXTRA_TITLE))` — `EXTRA_SUBJECT` first (the documented `ACTION_SEND`/Web-Share-Target title slot Chrome populates), `EXTRA_TITLE` as fallback. `[CITED: developer.chrome.com/docs/capabilities/web-apis/web-share-target]`
- **Re-verify cost on SDK/library bumps:** BOUNDED and FAILS LOUD. On each `expo-share-intent` version bump the patch filename (`+8.0.1`) no longer matches, and patch-package either applies with fuzz or errors visibly during install — it can never silently no-op. Re-cut the patch against the new version and rebuild. This is a known, one-file cost. Upstreaming the fallback to `achorein/expo-share-intent` is the better long-term play (noted for later, not this phase).

**Why NOT a config-plugin mod:** the target string lives inside `node_modules/expo-share-intent/android/src/.../ExpoShareIntentModule.kt`, which autolinking compiles directly from `node_modules` — so a `withDangerousMod` plugin would have to string-replace that same node_modules file at prebuild time, i.e. re-implement patch-package with more code and a silent-failure surface (a string replace that finds nothing just does nothing). patch-package is the ecosystem-standard, loud-on-drift mechanism.

**Pipeline note:** the desktop build runs `npm ci` on `droid`, which **does** run `postinstall`, so patch-package applies there; the committed `patches/` dir travels with the tar-over-ssh transfer. This postinstall is a plain diff-applier — **not** a TS loader hook, so it does not touch the `app.config.ts` metro-resolution hazard called out in that file's header comment `[VERIFIED: read app.config.ts:2-13]`.

### Q2 — `text/plain`-only intent filter through the config plugin

**Exact config shape** in `app.config.ts` plugins:
```ts
["expo-share-intent", { "androidIntentFilters": ["text/plain"] }]
```
- The plugin default when unconfigured is `["text/*"]`; passing `["text/plain"]` sets `newFilters = ["text/plain"]` → a single `<data android:mimeType="text/plain"/>` on `.MainActivity` `[VERIFIED: tarball read of plugin/build/android/withAndroidIntentFilters.js, dossier platform-refresh.md Claim 2]`.
- The Kotlin text branch gates on `intent.type!!.startsWith("text/plain")` (line 125) `[VERIFIED: tarball read]`. Registering the broader `text/*` would make Orbit appear for `text/html` shares that then fall to the file branch and call `notifyError("empty uri for file sharing")` — an error surface. `text/plain`-only is the correct narrowing (confirms the module gates its text branch on `text/plain`).
- **Do NOT set `androidMultiIntentFilters`** — leaving it unset keeps `ACTION_SEND_MULTIPLE` unregistered (multi-item share out of v1 scope) `[VERIFIED: tarball, ACTION_SEND_MULTIPLE emitted only if set]`.
- **A `scheme` MUST be added to `app.config.ts`** — the config plugin requires one and none is currently set `[VERIFIED: grep of app.config.ts/app.json returned no scheme]`. Add e.g. `scheme: "orbit"`.
- **Dedupe mechanics (01-01 lesson):** `app.config.ts` dedupes string plugins via a `Set`, but a `["expo-share-intent", {…}]` **tuple** is a distinct member from a bare string and cannot be Set-deduped — mirror the existing `expo-image-picker` tuple handling: append the share-intent tuple **after** the name-dedupe `filter`, exactly once. A duplicate plugin entry is a prebuild error `[VERIFIED: read app.config.ts:54-77]`.

### Q3 — `launchMode="singleTask"` side effect + `finish()` return-to-source (and the missing finish API)

- **`singleTask` is app-wide** (plugin default `{"android:launchMode":"singleTask"}` on `.MainActivity`) `[VERIFIED: tarball withAndroidMainActivityAttributes.js]`. Every entry point (notification tap, widget tap, deep link) now reuses one activity instance and arrives via `onNewIntent`, not a fresh `onCreate`. **Recorded for Phases 11/12; not built here.**
- **Plain `finish()` returns to source, `finishAndRemoveTask()` lands on home** `[CITED: developer.android.com/about/versions/15/behavior-changes-15, "Secured background activity launches"]`. On Android 15+, a **top-of-task** activity's `finish()` returns to the last-active task (the sharing app); a **non-top** activity's `finish()` goes home. The library's `handleShareIntent` re-launches with `FLAG_ACTIVITY_NEW_TASK` when `!activity.isTaskRoot`, so capture runs as the **root of Orbit's task** → the top-of-task case → returns to source `[VERIFIED: tarball ExpoShareIntentModule.kt:116-122 + Android docs]`.
- **The library provides NO finish/return API** — only `resetShareIntent()` and `hasShareIntent` `[CITED: github.com/achorein/expo-share-intent README, fetched 2026-08-16]`. The plan **must supply** the `finish()` mechanism:
  - **Recommended:** a **~10-line local Expo native module** exposing `finish()` that calls `appContext.currentActivity?.finish()` (Kotlin). This guarantees the exact `finish()` (not `finishAndRemoveTask()`) the dossier locks. Since a native patch is already in play (Q1), the incremental native surface is small.
  - **Do NOT rely on `BackHandler.exitApp()`** — its native mapping is RN-version-dependent and may translate to `finishAffinity`/`moveTaskToBack`/home rather than a clean `finish()`, which would break "return to source." If the planner still wants to try it to avoid native code, it must be **Pixel-verified** against both criteria (returns to the sharing app; does NOT land on home) before adoption. [ASSUMED — the exact RN 0.86 `exitApp()` mapping was not verified this session]
- **Back-stack implications (recorded for 11/12, not built):** because capture is the task root, Android system Back from the picker behaves like `finish()` (returns to source) — matching the "Close/Cancel pill cancels without writing" UI-SPEC contract. Notification/widget taps landing on the same `singleTask` instance need explicit back-stack design in 11/12.
- **Android 16 intent-redirection hardening (API 36, all apps):** the library's `Intent(intent).addFlags(FLAG_ACTIVITY_NEW_TASK)` re-launch carries a resolved component so it *should* pass, but this is the one code path touching the hardened area — **verify on an API-36 device** `[CITED: developer.android.com/about/versions/16/behavior-changes-all]`. On-device check, not a code task.

### Q4 — Cold-start ordering (F-CAP-10): the picker read is safe; migrations are already gated, sweeps do NOT need to gate the read

Verified by reading the actual boot path `[VERIFIED: read App.tsx + database.ts + launch-sweep.ts on disk]`:
- **Migrations are ALREADY guaranteed complete before any screen queries.** A share intent lands on `.MainActivity` → the full RN app → `App.tsx`. `AppShell` holds `ready=false` until `openAndMigrate()` **resolves**, and the `NavigationContainer`/`RootNavigator` is mounted **only** in the `ready && !error` branch (App.tsx:77-127). The capture picker is a route on that same navigator, so it cannot mount — and cannot query — before migrations finish. **The plan must keep the capture screen inside the `ready`-gated navigator** (do not add a pre-`ready` fast path). This satisfies "migrations MUST complete before any query" with zero new code.
- **The launch sweeps do NOT need to gate the picker read.** `installSweepTrigger` fires `void runLaunchSweep()` **fire-and-forget** (not awaited), so the field sweep (which does `DELETE` + `DROP COLUMN` on `contact_custom_values`) runs **concurrently** with the mounted navigator. A read-only `contacts`/`fuel` query is on **different tables**, untouched by a `contact_custom_values` DROP COLUMN. WAL journal mode + `busy_timeout = 5000` + the picker read taking **no** mutex (it is a plain `getAllAsync`, not `inWriteTransaction`) means the read neither blocks on nor deadlocks against the in-flight sweep. **Conclusion: the picker may query `contacts`/`fuel` before the sweeps complete — safe, decided (not assumed).**
- **Nuance for the WRITE path:** the capture fuel write *does* take the shared mutex (`inWriteTransaction`), so it serialises behind an in-flight sweep — correct and intended. In practice the user picks a contact seconds after the cold-start sweep has drained, so contention is negligible; even under contention, correctness (not just speed) is preserved by the mutex.

### Q5 — Multi-attach = N independent fuel rows in ONE transaction (composed cores, never nested mutex)

Verified against the actual DAO contract `[VERIFIED: read fuel-dao.ts + transaction.ts on disk]`:
- `addFuelCore(exec, input)` is the **non-mutexed** insert primitive that assumes `BEGIN` is already open; `addFuel` is the mutexed single-caller wrapper. `fuel-dao.ts:16-20` explicitly names this phase: *"Phase 10's multi-attach capture will compose `addFuelCore` N times inside ONE outer `inWriteTransaction` so a whole fan-out is atomic — never nesting the mutex."*
- **Concrete plan shape:** `captureMultiAttach(exec, rows) => inWriteTransaction(exec, async () => { for (const r of rows) await addFuelCore(exec, r); })`. Each contact gets its own row (its own `uid`); one atomic transaction; a throw anywhere rolls back the whole fan-out. Put this composer in a `capture-dao.ts` (or extend `fuel-dao`) and node-test it via the `node-sqlite` testkit like every other DAO.
- **The mutex is NON-REENTRANT** — never call `addFuel`/`inWriteTransaction` from inside the loop (that is the documented permanent-hang, transaction.ts:11-29). Compose the `*Core`, wrap once.
- **Capture NEVER writes `last_contact` or an interaction row** — it uses only `addFuelCore`. `source='share'`, `kind='topic'`. This keeps DATA-04's single-writer invariant intact and keeps the status engine uncorrupted by sharing habits (§6, the LinkListener hazard). The `FuelSource` type already documents `'share'` as the Phase-10 provenance `[VERIFIED: fuel-dao.ts:44-50]`.
- **Inline-create-then-capture** composes similarly but across two DAOs: `createContactFull` (name-only) returns `{ contactId }`, then a fuel write to that id. These are two separate transactions (create commits first, then the fuel row) — acceptable and simplest; a single-transaction fusion is unnecessary since the created contact is immediately valid. If the planner wants atomicity, a new composed core would be required (more surface, not warranted for v1).

### Q6 — Payload parsing and note composition

Put ALL of this in a pure, node-tested `src/logic/capture-logic.ts` (the `-logic.ts` / pure-resolver idiom; `.tsx` is Pixel-UAT). What the library delivers to JS `[VERIFIED: tarball utils.js:62-69 regex + module source]`:
- `text` = raw `EXTRA_TEXT`; `webUrl` = the **first** `http…` regex match from `text` (or null); `meta.title` = `EXTRA_SUBJECT` **after the Q1 patch** (else undefined).

**Payload → row mapping (display text + canonical `url`):**

| Share shape | `text`/`webUrl`/`title` | display text | `url` column |
|-------------|--------------------------|--------------|--------------|
| Bare URL (Chrome) + `EXTRA_SUBJECT` | text=URL, webUrl=URL, title=page title | **the title** | the URL |
| Bare URL, no `EXTRA_SUBJECT` | text=URL, webUrl=URL, title=undefined | **the bare URL** (fallback) | the URL |
| Plain text selection | text=prose, webUrl=null | **the text** | null |
| Prose containing a URL | text=prose, webUrl=first match | **the prose** | first `http…` match |

The `url` column is **always canonical and separate**; user prose never overwrites it (F-CAP-6/F-CAP-15, binding). Map to the fuel row as `label`=null / `text`=display / `url`=canonical (fuel columns: `kind,label,text,url,created_at,source,modified_at`) — display text lands in `fuel.text`; the ranked projection requires non-blank `text`, so blank → NULL at the boundary `[VERIFIED: fuel-read.ts RANKED_FUEL_EXCLUSIONS]`. (Planner: confirm whether the captured title/prose belongs in `text` vs `label`; `text` is correct because `getRankedFuel`/dashboard rank on non-blank `text` and off-limits/blank filtering operates on `text`.)

**Note composition (when the user adds an optional note):** display text is recomposed as **`note — title`** — note leads, `" — "` separator, then the shared title/label appended. Note-only → the note; title-only → the title; the `url` column is untouched in every case. The note edits the just-written row's display text via `editFuelCore`/`editFuel` (patch-scoped UPDATE of `text` only, `url`/`created_at` untouched) `[VERIFIED: fuel-dao.ts editFuelCore patch semantics]`. For multi-attach, the note applies to **all N** rows' display text.

**Edge cases to node-test:** multi-URL text (only first URL captured — document the loss), whitespace-only text → NULL, a note with an embedded ` — `, empty payload (defensive "Nothing to save" error state), and the `note`+no-title case (display = note alone, no trailing separator).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-share-intent` | **8.0.1** | Android share-target registration (config plugin) + `useShareIntent` hook + native intent stash | The **only** maintained SDK-57 route; `react-native-receive-sharing-intent` is dead (last publish 2021). Owner-locked in the dossier. `[VERIFIED: npm registry, latest=8.0.1, expo:^57]` |
| `patch-package` | latest (^8) | Apply the `EXTRA_SUBJECT` Kotlin diff at install | Ecosystem-standard, loud-on-drift native-patch mechanism (Q1) `[ASSUMED — pick current version at install]` |

### Supporting (reuse — already in the repo, no install)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `src/db/fuel-dao.ts` (`addFuel`/`addFuelCore`) | The capture write path | Every capture write; compose `addFuelCore` for multi-attach |
| `src/db/contacts-dao.ts` (`createContactFull`) | Name-only inline create | The ＋ New contact tile path (omit `firstInteraction` → `last_contact` NULL) |
| `src/db/dashboard-read.ts` (`listFavourites`) | Favourites band source | The favourites-first picker band |
| `src/db/transaction.ts` (`inWriteTransaction`) | The single write mutex | Wrap the multi-attach fan-out ONCE |
| `src/components/Avatar.tsx` (size 64, `cacheBust=modified_at`) | Grid-of-faces tiles | Verbatim; recyclingKey is a correctness req in the recycling grid |
| react-navigation native-stack (`RootStackParamList`) | New capture route | Register additively (like `Compose`/`NeverContacted`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-share-intent` | `react-native-receive-sharing-intent` | Dead since 2021; predates New Architecture + config plugins — do NOT use |
| patch-package | fork the library / config-plugin `withDangerousMod` | Fork = ongoing maintenance of ~380 lines; withDangerousMod = re-implementing patch-package with silent-failure surface |
| Local native `finish()` bridge | `BackHandler.exitApp()` | exitApp mapping is RN-version-dependent; may land on home, breaking return-to-source (Q3) |

**Installation:**
```bash
npx expo install expo-share-intent          # pins the SDK-57-aligned 8.0.1
npm install --save-dev patch-package         # + add "postinstall": "patch-package"
```
`expo-constants`/`expo-linking` are pulled in as peer deps (currently absent from the repo) `[VERIFIED: peerDependencies expo-constants>=57.0.3, expo-linking>=57.0.1]`.

**Version verification (today):** `npm view expo-share-intent` → `version 8.0.1`, `latest 8.0.1`, `time.modified 2026-07-10`, `peerDependencies.expo ^57` — unchanged since the dossier's 2026-08-13 check. Project runs `expo ~57.0.13`, `react-native 0.86.2` `[VERIFIED: package.json + npm registry, 2026-08-16]`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `expo-share-intent` | npm | created 2024-02-21 (~2.5 yr) | ~115k/wk | github.com/achorein/expo-share-intent | OK (with note) | Approved — owner-locked; **single-maintainer** (achorein) bus-factor-1 on a load-bearing path, ~380-line Kotlin, forkable if it lapses. No `postinstall` script. `[VERIFIED: npm registry 2026-08-16]` |
| `patch-package` | npm | mature, millions/wk | high | github.com/ds300/patch-package | OK | Approved (devDependency) `[ASSUMED — standard tooling; confirm exact version at install]` |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none blocking. `expo-share-intent` is single-maintainer — a named risk the owner already accepted in the dossier ("Decisions made without you" #1). Not a checkpoint blocker; recorded so the fork-if-it-lapses contingency stays visible.

## Architecture Patterns

### System Architecture Diagram

```
 Another app's share sheet (Chrome / social / messaging)
        │  ACTION_SEND, text/plain
        ▼
 Android system  ──►  Orbit .MainActivity  (launchMode=singleTask, intent filter: text/plain)
        │                     │
        │  (cold start)       │  expo-share-intent native listener stashes intent
        ▼                     ▼
 App.tsx boot: openAndMigrate() ── resolves ──►  ready=true ──► NavigationContainer mounts
        │                                                    (launch sweep fires fire-and-forget, concurrent)
        ▼
 useShareIntent() drains the stashed intent  ──►  capture-logic.ts (pure)
        │                                              parse: display text + canonical url
        ▼
 Capture Picker screen  ◄── capture-read.ts: SELECT contacts (favs → capture-MRU → rest, excl. archived)
        │                                        (read-only; no mutex; safe alongside the sweep — Q4)
        │
        ├─ single tap face ──► addFuel(topic, source='share')            ─┐
        ├─ long-press → multi ─► inWriteTransaction{ addFuelCore × N }    ├─► fuel rows (contact_id NOT NULL)
        └─ ＋ New contact ──► createContactFull(name-only) → addFuel      ─┘   NO last_contact / interaction write
                │
                ▼
        Confirmation + optional note surface  ── note ──► editFuel(text = "note — title")
                │  (setState + setTimeout, NEVER per-frame animation)
                ▼
        native finish()  ──►  returns to the sharing app
```
File-to-implementation mapping is in the Component Inventory (UI-SPEC) + Don't-Hand-Roll table; the diagram shows data flow only.

### Recommended additions (net-new files)
```
src/logic/capture-logic.ts        # pure payload→{displayText,url} + note composition; node-tested
src/logic/capture-logic.test.ts   # Vitest edge cases
src/db/capture-read.ts            # favourites → capture-MRU → rest query; node-tested
src/db/capture-read.test.ts
src/db/capture-dao.ts             # (or extend fuel-dao) multi-attach composer; node-tested
src/screens/CaptureScreen.tsx     # grid FlatList + confirmation/note surface; Pixel-UAT
src/screens/capture-*.tsx         # (optional) inline-create + tiles, Claude's discretion
# native: patches/expo-share-intent+8.0.1.patch  +  a tiny local finish() module
```

### Pattern 1: Capture-MRU picker query (net-new read)
**What:** Order all non-archived contacts favourites → most-recently-captured-to → rest, no new column.
**When:** The picker load (`capture-read.ts`, node-tested via `node-sqlite` testkit).
```sql
-- Source: composed from existing schema (contacts + fuel), verified against dashboard-read.ts idiom
SELECT c.id, c.name, c.photo, c.modified_at, c.favourite_rank,
       m.last_captured
  FROM contacts c
  LEFT JOIN (SELECT contact_id, MAX(created_at) AS last_captured
               FROM fuel GROUP BY contact_id) m ON m.contact_id = c.id
 WHERE c.archived_at IS NULL          -- excludes archived; INCLUDES never-contacted (no last_contact filter)
 ORDER BY (c.favourite_rank IS NULL),  -- favourites first (rank present)
          c.favourite_rank ASC,
          (m.last_captured IS NULL),    -- then capture-MRU (has any fuel)
          m.last_captured DESC,
          c.name COLLATE NOCASE ASC;    -- then the rest, stable by name
```
Keep the ordering deterministic and node-tested; the `.tsx` grid just renders it. `[VERIFIED: schema from migrations/001-initial.ts CREATE_FUEL + contacts; idiom from dashboard-read.listFavourites]`

### Pattern 2: Multi-attach fan-out (composed cores, one transaction)
See Q5. `inWriteTransaction(exec, async () => { for (const r of rows) await addFuelCore(exec, r); })`.

### Anti-Patterns to Avoid
- **Nesting the mutex** (calling `addFuel`/`inWriteTransaction` inside the multi-attach loop) → permanent hang (transaction.ts:11-29).
- **Writing `last_contact` or an interaction row on capture** → corrupts the status engine; reintroduces the LinkListener "mention ⇒ mark contacted" hazard (§6).
- **Holding the payload in React state until a confirm tap** → `resetOnBackground: true` kills it on background (FINDING D). Write on pick.
- **A system contact picker** → backgrounds the app, destroys the payload. In-app SQLite screen only.
- **Registering `text/*`** → Orbit errors on `text/html` shares (FINDING/Claim 2).
- **Storing the URL inside editable prose** → shuts the door on dedupe/enrichment permanently (F-CAP-6). Keep `url` its own column.
- **Per-frame animation driven by React state** for the toast/note surface → CLAUDE.md; use `setState` + `setTimeout` (mirror 09's "Copied" pattern).
- **A JS-only `EXTRA_SUBJECT` fix** → the extra never reaches JS; must be the native patch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Android intent-filter registration | Manual `AndroidManifest` editing | `expo-share-intent` config plugin | Survives `prebuild --clean`; lands on `.MainActivity` correctly |
| Cold/warm intent delivery to JS | Custom native listener | `useShareIntent()` | Cold-start stash-before-JS is already handled correctly (FINDING: cold start sound) |
| Fuel row insert | New INSERT in the screen | `addFuel`/`addFuelCore` | DAO-only writes; both-keys guard; `?`-bound; composable core exists for multi-attach |
| Multi-row atomicity | `withTransactionAsync` / manual BEGIN | `inWriteTransaction` + `*Core` | The single shared non-reentrant mutex; expo's `withTransactionAsync` captures unrelated concurrent writes (transaction.ts:26-29) |
| Name-only contact create | New INSERT | `createContactFull` (omit `firstInteraction`) | Atomic; leaves `last_contact` NULL (never-contacted) per CRUD-02 |
| Favourites read | New query | `dashboard-read.listFavourites` | Already archived-filtered, rank-ordered |
| Avatar rendering in the grid | New image component | `Avatar` (size 64, `cacheBust=modified_at`) | recyclingKey anti-face-flash is a correctness req in a recycling grid |
| URL extraction from text | Custom parser in the screen | The library's `webUrl` (first `http…`) + a pure `capture-logic.ts` | Keep parsing testable and out of the `.tsx` |

**Key insight:** almost everything here already exists and is node-tested; the net-new correctness code is small (payload parsing, the MRU query, the fan-out composer) and belongs in `-logic.ts`/DAO modules, not the screen. The native surface (patch + finish bridge) is the only genuinely new-risk work and is Pixel-UAT.

## Common Pitfalls

### Pitfall 1: Assuming `meta.title` yields Chrome page titles
**What goes wrong:** you build the label flow on `meta.title`, test with a Chrome share, get `undefined`, and wrongly conclude "Android doesn't give you the title."
**Root cause:** the library reads `EXTRA_TITLE`; Chrome writes `EXTRA_SUBJECT`.
**Avoid:** apply the Q1 patch; keep the bare-URL fallback for senders that set neither.
**Warning sign:** null titles on every browser share in UAT.

### Pitfall 2: The payload dies when the app backgrounds
**What goes wrong:** the user tabs away (or a dialog backgrounds the app) mid-flow and the capture is silently lost.
**Root cause:** `useShareIntent({ resetOnBackground: true })` default (FINDING D).
**Avoid:** write the fuel row on contact-pick, before any note prompt; keep every step in-app (no system picker, no permission dialog on the fast path).

### Pitfall 3: Native changes invisible to a Metro reload
**What goes wrong:** you "test" the share flow over a JS reload and see nothing, or stale behaviour.
**Root cause:** a new native module + manifest intent filter + `singleTask` require a real build.
**Avoid:** UAT via `expo prebuild --clean` + release APK on the physical Pixel (desktop pipeline). A Metro reload will not surface the native module.

### Pitfall 4: Landing on home instead of the source app
**What goes wrong:** after commit the user lands on the launcher, not the app they shared from.
**Root cause:** `finishAndRemoveTask()` (or a `BackHandler.exitApp()` that maps to it), or capture not being the task root.
**Avoid:** plain `Activity.finish()` via the local bridge; rely on the library's `FLAG_ACTIVITY_NEW_TASK` re-launch making capture the task root (Q3).

### Pitfall 5: `app.config.ts` plugin dedupe / missing scheme
**What goes wrong:** a duplicate plugin entry or a missing `scheme` fails the prebuild.
**Root cause:** the Set-dedupe can't dedupe a `[name, opts]` tuple; the plugin requires a scheme (01-01 lesson).
**Avoid:** append the share-intent tuple after the name-dedupe filter (mirror the picker tuple); add `scheme`.

### Pitfall 6: Cold-start read racing DDL
**What goes wrong:** worry that the picker query hits the DB mid-`DROP COLUMN`.
**Reality (Q4):** migrations are gated by `ready`; the sweep runs concurrently but touches `contact_custom_values`, not `contacts`/`fuel`; WAL + busy_timeout + a mutex-free read make it safe. Keep the capture screen on the `ready`-gated navigator — do not add a pre-`ready` path.

## Code Examples

### The Kotlin patch (Q1) — conceptual diff
```kotlin
// Source: ExpoShareIntentModule.kt text/plain branch (line ~132), patched via patch-package
"meta" to mapOf(
    "title" to (intent.getStringExtra(Intent.EXTRA_SUBJECT)      // Chrome page title
                ?: intent.getCharSequenceExtra(Intent.EXTRA_TITLE)) // sharesheet preview title (original)
)
```

### The finish() bridge (Q3) — conceptual local module
```kotlin
// A ~10-line local Expo module. Guarantees Activity.finish() (NOT finishAndRemoveTask).
@ExpoMethod
fun finish() { appContext.currentActivity?.finish() }
```

### Multi-attach (Q5) — verified against fuel-dao/transaction contracts
```ts
// Source: fuel-dao.ts (addFuelCore) + transaction.ts (inWriteTransaction), read on disk
export function captureMultiAttach(exec: SqlExecutor, rows: NewFuelItem[]): Promise<void> {
  return inWriteTransaction(exec, async () => {
    for (const row of rows) await addFuelCore(exec, row); // one BEGIN, N inserts, atomic
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-native-receive-sharing-intent` | `expo-share-intent` (config plugin, New Arch) | library dead since 2021 | Only maintained SDK-57 route |
| `ChooserTargetService` (Direct Share) | Sharing Shortcuts API | Android 11 (API 30) | Direct Share needs a custom native module — OUT of v1 scope |
| Free finish/back stack | Android 15 top-vs-non-top finish rule | API 35 | `finish()` semantics now depend on task position (Q3) |
| Nested intent extras launch components | Blocked by default (intent-redirection hardening) | Android 16 (API 36, all apps) | Verify the library's intent re-launch on an API-36 device |

**Deprecated/outdated:** `react-native-receive-sharing-intent` (do not use); `ChooserTargetService` (deprecated API 30).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `BackHandler.exitApp()`'s RN 0.86 native mapping is uncertain — recommend a native `finish()` bridge instead | Q3 | If the bridge is skipped and exitApp maps to home, return-to-source (CAP-04) breaks — Pixel-verify |
| A2 | `patch-package` current major (^8) is the right tool version | Standard Stack | Low — confirm at install |
| A3 | Android 16 intent-redirection hardening does not block the library's `FLAG_ACTIVITY_NEW_TASK` re-launch | Q3 / State of the Art | Capture may fail to launch on API-36 — dossier says "should be fine," must be device-verified |
| A4 | Captured display text belongs in `fuel.text` (not `label`) so ranking/exclusions apply | Q6 | If placed in `label`, a captured item could rank as blank-text and be dropped by `RANKED_FUEL_EXCLUSIONS` — planner confirm |

## Open Questions

1. **`finish()` mechanism — native bridge vs `BackHandler.exitApp()`.**
   - Known: the library provides no finish API; plain `finish()` returns to source.
   - Unclear: exact `exitApp()` mapping on RN 0.86.
   - Recommendation: ship the ~10-line native `finish()` bridge for deterministic semantics; Pixel-verify either way.
2. **Android 16 (API 36) intent re-launch survival.**
   - Known: the copied intent carries a resolved component.
   - Unclear: whether hardening blocks it in practice.
   - Recommendation: on-device check on an API-36 device before treating return-to-source as settled.
3. **Cold-start-to-picker latency on the physical Pixel.**
   - Known: bounded by full-app cold start (no trampoline possible, FINDING F).
   - Recommendation: measure on the Pixel (not the emulator); if slow, the fix is app-startup work, not share-sheet work.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `expo-share-intent` | intent registration + delivery | ✗ (not yet installed) | 8.0.1 (target) | none — required |
| `patch-package` | `EXTRA_SUBJECT` patch | ✗ (add devDep) | ^8 | none — required for CAP-03 |
| `expo`/`react-native` | host | ✓ | 57.0.13 / 0.86.2 | — |
| Desktop build pipeline (`ssh droid` → prebuild+assembleRelease → scp APK) | on-device UAT (native module) | ✓ (proven Phase 1) | — | none — the only APK path; this box cannot build APKs |
| Physical Pixel 6 Pro (API 36) | share flow + return-to-source + latency UAT | ✓ (owner's device, USB) | — | desktop emulator CANNOT assess share flow / perf |

**Missing dependencies with no fallback:** `expo-share-intent`, `patch-package` — both installs are the first tasks of the phase.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (node), `node-sqlite` testkit for DAOs |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test` (`vitest run`) |
| Full suite command | `npm test && npx tsc --noEmit && npm run check:colors` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAP-03 | payload → display text + canonical url; note "note — title" composition | unit | `vitest run src/logic/capture-logic.test.ts` | ❌ Wave 0 |
| CAP-01 | picker order favourites → MRU → rest, excl. archived, incl. never-contacted | unit (DAO) | `vitest run src/db/capture-read.test.ts` | ❌ Wave 0 |
| CAP-02 | multi-attach writes N rows atomically; no `last_contact`/interaction write | unit (DAO) | `vitest run src/db/capture-dao.test.ts` | ❌ Wave 0 |
| CAP-02/04 | single-tap commit, long-press multi-select, note flow, ＋ inline create, return-to-source | manual (Pixel UAT) | release APK + `uiautomator dump` on locked testIDs | manual-only |
| CAP-01/03/04 | share appears only for `text/plain`, Chrome title labelling, return to source, cold-start latency | manual (Pixel UAT) | prebuild --clean + release APK | manual-only |

Native share registration, `singleTask`, `finish()`/return-to-source, and Android 16 intent-hardening are **UAT-only** (no automated harness can drive the OS share sheet). Everything correctness-critical (parsing, ordering, atomicity, no-touchpoint) is node-tested.

### Sampling Rate
- **Per task commit:** `npm test` (targeted `-logic`/DAO files).
- **Per wave merge:** `npm test && npx tsc --noEmit && npm run check:colors`.
- **Phase gate:** full suite green + Pixel UAT (share from Chrome → pick → note → return; multi-select; inline create) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/logic/capture-logic.test.ts` — CAP-03 payload/note composition
- [ ] `src/db/capture-read.test.ts` — CAP-01 picker ordering + archived exclusion
- [ ] `src/db/capture-dao.test.ts` — CAP-02 multi-attach atomicity + no-touchpoint assertion (grep-verify no `last_contact`/interaction write in the capture path)

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | **yes** | Shared payload (`EXTRA_TEXT`/`EXTRA_SUBJECT`) is **attacker-influenceable third-party text**. All DB writes are `?`-bound via the DAOs (no interpolation); the page title is stored as data, never executed/interpolated. Treat the title as untrusted display text. |
| V6 Cryptography | no | No crypto in capture |
| V2/V3/V4 Auth/Session/Access | no | Local single-user app; no auth surface |
| V1 Data Protection (local-first) | **yes** | Capture reads local SQLite ONLY — no network on any path. `source='share'` provenance recorded. `off_limits` is never a capture kind (default `topic`). No contact data leaves the device. |

### Known Threat Patterns for the Android share-target stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious page title / prose as display text | Tampering / Info-disclosure | `?`-bound DAO writes; store as data only; `RANKED_FUEL_EXCLUSIONS` keeps blank/off-limits out of glance surfaces |
| Intent redirection (Android 16) | Elevation of Privilege | Library re-launch carries a resolved component; verify on API-36 (Q3/A3) |
| Payload loss on background (silent capture loss) | Denial (data loss) | Write on pick; in-app-only flow (FINDING D) |
| URL in prose opened later | (link handling — Phase 4 concern) | Capture only *stores* the url; link-open uses the existing https-only allowlist (04-07), not this phase |

Capture opens **no** new network path and requests **no** new runtime permission — it strengthens, not weakens, the privacy posture. The single native-surface risk (patch + finish bridge + intent-hardening) is behaviour, verified on-device.

## Sources

### Primary (HIGH confidence)
- `docs/dossier/workpapers/03-fuel/platform-share-intent.md` — tarball reads of `expo-share-intent@8.0.1` Kotlin/JS (FINDINGS A–H).
- `docs/dossier/workpapers/03-fuel/overlap-capture.md` — F-CAP-1…F-CAP-15 seam analysis.
- `docs/dossier/workpapers/10-capture/platform-refresh.md` — 2026-08-13 re-verification (Claims 1–5).
- `docs/dossier/10-capture.md` — binding `[DECIDED]`/`[REJECTED]` record.
- On-disk code: `fuel-dao.ts`, `contacts-dao.ts`, `transaction.ts`, `fuel-read.ts`, `dashboard-read.ts`, `database.ts`, `launch-sweep.ts`, `App.tsx`, `RootNavigator.tsx`, `app.config.ts`, `migrations/001-initial.ts`, `Avatar.tsx`.
- npm registry (2026-08-16): `expo-share-intent` 8.0.1, expo:^57, no postinstall, ~115k dl/wk, repo achorein.

### Secondary (MEDIUM confidence)
- developer.android.com — behaviour changes 15 (background activity launches, top-of-task finish) and 16 (intent-redirection hardening); Play target-API requirement (API 36 from 2026-08-31).
- developer.chrome.com/docs/capabilities/web-apis/web-share-target — `{title}`≡`EXTRA_SUBJECT`, `{text}`≡`EXTRA_TEXT`.
- github.com/achorein/expo-share-intent README (fetched 2026-08-16) — API surface (`resetShareIntent`/`hasShareIntent`); confirms no finish API.

### Tertiary (LOW confidence)
- RN 0.86 `BackHandler.exitApp()` native mapping — not verified this session (A1); Pixel-verify.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — version + peer deps + source re-verified today; owner-locked library.
- Architecture / reused code paths: HIGH — every path read on disk.
- Native `finish()` + Android 16 hardening: MEDIUM — recommendation is sound; exact device behaviour is a Pixel/API-36 check (A1/A3).
- Payload/parsing/pitfalls: HIGH — tarball-verified library behaviour + on-disk fuel contracts.

**Research date:** 2026-08-16
**Valid until:** ~2026-09-15 (re-confirm `expo-share-intent` latest at build time per the dossier's "confirm current pinned version" deferral; it is single-maintainer with an SDK-tied cadence).
