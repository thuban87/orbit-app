# Workpaper — Dashboard reactive read path & offline guarantee

**Domain:** 08-dashboard
**Decision anchors:** HANDOFF §3 ("no blocking network call on any read path"; local-first); dashboard reads on-device SQLite only; "Mark contacted" can be written HEADLESSLY from a widget broadcast / notification action while the foreground app is not running.
**Verified against:** Expo SDK **57.0.0**, **expo-sqlite@57.0.1** (published 2026-07-15), expo-image (SDK 57), React Native 0.86. SQLite C API (authoritative sqlite.org).
**Task type:** read/verify only — no project code changed. No `package.json`/`node_modules` exist in this repo yet; all claims verified against official docs, not installed source.

Primary sources:
- expo-sqlite SDK 57 API: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- expo-sqlite latest (tracks 57.0.0): https://docs.expo.dev/versions/latest/sdk/sqlite/
- expo-sqlite CHANGELOG (confirms 57.0.1 @ 2026-07-15; 57.0.0 @ 2026-06-25): https://github.com/expo/expo/blob/main/packages/expo-sqlite/CHANGELOG.md
- SQLite `sqlite3_update_hook()` — "Data Change Notification Callbacks": https://www.sqlite.org/c3ref/update_hook.html
- SQLite User Forum (scope of update_hook): https://sqlite.org/forum/forumpost/2a3c3c9d97
- expo-image SDK 57: https://docs.expo.dev/versions/v57.0.0/sdk/image/
- react-navigation `useFocusEffect`: https://reactnavigation.org/docs/use-focus-effect/

---

## 1. Reactive reads / live dashboard

### 1a. Does expo-sqlite@57 expose a change listener?

Yes. `SQLite.addDatabaseChangeListener(listener)` returns an `EventSubscription`. The callback receives a `DatabaseChangeEvent` with **four** fields (SDK 57 doc, verbatim field descriptions):

- `databaseName` — "The database name. The value would be `main` by default and other database names if you use `ATTACH DATABASE` statement."
- `databaseFilePath` — "The absolute file path to the database."
- `tableName` — "The table name."
- `rowId` — "The changed row ID." (a `number`)

**It must be explicitly enabled.** You must open the DB with `enableChangeListener: true` in `SQLiteOpenOptions`. The doc defines that option as (verbatim): *"Whether to call the `sqlite3_update_hook()` function and enable the `onDatabaseChange` events."* Default is `false`. Source: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/

That one sentence names the underlying mechanism — SQLite's `sqlite3_update_hook()` — and the mechanism's semantics are the whole story for the headless case (§1c).

### 1b. What the listener fires on, and its hard limitations

The Expo doc is **silent** on cross-connection / cross-process scope. The behavior is therefore governed entirely by `sqlite3_update_hook()`, which is authoritative:

- **Row-level only, rowid tables only.** SQLite doc: the callback is "invoked whenever a row is updated, inserted or deleted in a **rowid table**." It reports the operation type (INSERT/UPDATE/DELETE), the table name, and the rowid. Source: https://www.sqlite.org/c3ref/update_hook.html
- **NOT invoked for WITHOUT ROWID tables**, nor for internal system tables (e.g. `sqlite_sequence`).
- **NOT invoked for the truncate optimization** (a bare `DELETE FROM t` with no WHERE deletes all rows without visiting them), **nor for rows deleted by an `ON CONFLICT REPLACE` clause.** Verbatim: *"In the current implementation, the update hook is not invoked when conflicting rows are deleted because of an ON CONFLICT REPLACE clause. Nor is the update hook invoked when rows are deleted using the truncate optimization."* Practical consequence: a "clear all" implemented as `DELETE FROM contacts` fires **no** change event; add a WHERE or delete row-by-row if a listener must see it.
- **`ON DELETE CASCADE`**: the sqlite.org page does not explicitly address cascade deletes. Cascades execute as normal per-row deletes (they are not the truncate optimization), so they are expected to fire the hook per deleted row — but this is not stated verbatim on the page, so treat it as reasoned-from-mechanism, not a documented guarantee. Relevant to custom-field column drops / defs cascades if a listener is ever relied on there.

### 1c. THE load-bearing fact — the listener does NOT see headless writes

`sqlite3_update_hook()` is registered **on one specific database connection** and fires **only** for writes made **through that same connection**. Verbatim, SQLite doc: *"The sqlite3_update_hook() interface registers a callback function with the database connection identified by the first argument to be invoked whenever a row is updated, inserted or deleted..."* (https://www.sqlite.org/c3ref/update_hook.html)

The SQLite maintainers state the scope limit explicitly on the User Forum (https://sqlite.org/forum/forumpost/2a3c3c9d97): the update hook *"is registered on a connection ... it can only intercept changes invoked on said connection. It cannot access any changes made outside of that connection; **not even other threads in the same process using a different connection.**"* And: the hooks *"return information about what effects the statements YOU YOURSELF are executing on the database connection are having."*

**Apply this to Orbit's headless "Mark contacted":**

- A widget broadcast handler or a notification-action handler runs in a **separate JS context** (and, for some Android widget update paths, a separate process). It opens its **own** `SQLiteDatabase` connection to write `last_contact` / log the interaction.
- The foreground app's `addDatabaseChangeListener`, registered on the **foreground** connection, will **never fire** for that headless write — different connection, full stop. Cross-process is even further out of scope than the "different thread, same process" case the forum already rules out.
- Therefore **a change listener alone cannot keep the dashboard correct.** It is fine for reflecting *in-app, same-connection* writes (e.g. the user taps "Mark contacted" inside the app on another screen and navigates back), but it is structurally blind to the exact scenario §CONTEXT calls out.

### 1d. Recommended sync pattern for the dashboard

The reliable, documented mechanism for "show updated data after the user foregrounds the app following a headless write" is a **re-query on screen focus**, not a change listener:

- **`useFocusEffect`** (react-navigation, or re-exported by expo-router) runs an effect each time the screen regains focus and cleans up on blur. Re-run the dashboard's SQLite query there. This catches the return-from-background / return-to-tab case that covers a user coming back after a widget/notification write. Source: https://reactnavigation.org/docs/use-focus-effect/
- **`AppState` `change` → `active`**: foreground focus alone does not fire if the app was merely backgrounded while the dashboard screen stayed mounted and focused (Android home → widget tap → reopen can land back on the same focused screen without a navigation focus event). Add an `AppState` listener that re-queries when state transitions to `active`. Belt-and-suspenders with `useFocusEffect` covers both the navigation-focus and the process-foreground paths.
- **`useSQLiteContext()`** is the documented hook for *accessing* the DB inside a `<SQLiteProvider>` subtree (returns `SQLiteDatabase`). It is not reactive on its own — it just hands you the connection. Source: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
- There is **no** `useDatabaseChangeListener` or built-in reactive-query hook in expo-sqlite@57. "Live query" reactivity in this ecosystem comes from a third-party layer (e.g. Drizzle's `useLiveQuery`), which is itself built on `addDatabaseChangeListener` and therefore **inherits the same per-connection blindness** — it would not solve the headless case either. Not recommended to reach for it on that premise.

**Is a manual "refresh" button necessary?** No. On-focus re-query + an `AppState`→active re-query is sufficient and is the idiomatic pattern; the dataset is tiny (tens of contacts) so re-running the query on every focus is cheap. A manual refresh is optional UX polish, not a correctness requirement.

**Design takeaway:** the dashboard should be built to re-query SQLite on focus/foreground as its primary freshness mechanism. Treat `addDatabaseChangeListener` as an *optional* in-session nicety for same-connection writes, never as the thing that makes headless "Mark contacted" show up.

---

## 2. Offline / non-blocking guarantee

### 2a. expo-image on a local `file://` avatar — no network

expo-image's `source` accepts a local file path/URI and loads directly from the device filesystem; a `file://` source triggers **no** network request. Remote fetching only happens for `http(s)` sources. Source: https://docs.expo.dev/versions/v57.0.0/sdk/image/

- **`cachePolicy`** (`none` / `disk` / `memory` / `memory-disk`) governs the image cache. Its wording is about *downloaded* images ("otherwise it's downloaded and then stored on the disk"). For a `file://` source there is nothing to download; `memory-disk` is harmless (it just keeps the decoded bitmap in memory with a disk fallback) and does not introduce a network path. So the project's chosen `cachePolicy: memory-disk` is fine and does not weaken the offline guarantee.
- **Caveat on `file://` vs app sandbox:** the avatar files must live inside the app's own sandbox (e.g. the documents directory, `file://.../Documents/...`) so the URI is always readable regardless of external-storage permissions or scoped-storage. A `file://` pointing at shared/external storage could fail to load without a permission — but that is an image-availability concern, not a network concern, and the 07-photos workpaper already establishes avatars are stored as app-local 512px JPEGs. No network either way.

### 2b. expo-sqlite queries are async and off the JS critical path

All primary read methods are Promise-based: `getAllAsync()`, `getFirstAsync()`, `runAsync()`, `getEachAsync()` (async iterator). The async variants execute the SQL on a native thread and resolve a Promise, so they do not block the JS thread during execution. Source: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/

- **Real caveat:** the **Sync** variants (`getAllSync`, `runSync`, etc.) exist and, per the doc, *"Running heavy tasks with this function can block the JavaScript thread and affect performance."* The dashboard read path must use the **`...Async`** methods. This is the only way expo-sqlite can block the JS thread on a read, and it is opt-in — avoid the Sync API on any read path.

**Net:** nothing on the dashboard read path (local SQLite via async DAO + local `file://` avatar via expo-image) touches the network or blocks the JS thread, provided (a) async query methods are used and (b) avatars are app-sandbox local files. The HANDOFF §3 commitment holds.

---

## 3. List rendering at small scale (tens of contacts)

Scale is tiny (HANDOFF: design for tens, not thousands), so memory pressure from decoded bitmaps is a non-issue at this size. The one gotcha a designer should know:

- **`recyclingKey` is required for correctness in recycling lists.** expo-image doc, verbatim: changing `recyclingKey` *"resets the image view content to blank or a placeholder before loading and rendering the final image. This is especially useful for any kinds of recycling views like FlashList to prevent showing the previous source before the new one fully loads."* Without it, a recycled row can briefly show the **previous contact's** avatar before the new one decodes — a visible identity-mismatch flicker. Set `recyclingKey={contactId}` (the 07-photos workpaper already specifies per-contact recyclingKey). This applies to both FlashList and FlatList reuse.
- 512px JPEGs decoded for a few dozen rows is trivial memory; no need for aggressive downscaling or `allowDownscaling` tuning at this scale. `contentFit="cover"` for square avatar wells is correct.

---

## 4. Filter/sort/group UI-preference persistence (not load-bearing)

**Recommendation (one sentence):** persist the last-used sort/filter with **AsyncStorage** (`@react-native-async-storage/async-storage`) — it is the idiomatic Expo choice for small, non-secret key/value UI state, is async/non-blocking, and avoids coupling ephemeral view state to the domain schema; a `settings` row in SQLite is an acceptable alternative if you'd rather keep one store, and `expo-secure-store` is **wrong** here (it is for secrets/credentials only).

---

## Findings that change a design decision (delta from the QUESTIONS' assumptions)

1. **A change listener will NOT surface a headless "Mark contacted" write.** `addDatabaseChangeListener` is `sqlite3_update_hook()`, which fires only for writes on the *same connection* — "not even other threads in the same process using a different connection" (SQLite forum). The headless widget/notification write is on a different connection/context, so the foreground listener is blind to it. **The dashboard's freshness mechanism must be a re-query on focus (`useFocusEffect`) plus an `AppState`→`active` re-query — not a change listener.** This directly answers the CONTEXT scenario and contradicts any assumption that a listener could cover it.
2. **No blocking "clear all" event.** A `DELETE FROM contacts` (truncate optimization) and `ON CONFLICT REPLACE` deletes fire **no** change event — relevant only if a listener is ever relied upon; another reason not to lean on the listener for correctness.
3. **The offline guarantee holds, with two must-dos:** use the `...Async` query methods only (the `...Sync` variants block the JS thread by documented behavior), and keep avatars as app-sandbox `file://` files (expo-image makes zero network calls for local files; `cachePolicy: memory-disk` is safe).
4. **`recyclingKey` per contact is a correctness requirement, not an optimization** — without it recycled rows flash the previous contact's face.

Versions pinned: Expo SDK 57.0.0 · expo-sqlite 57.0.1 (2026-07-15) · expo-image (SDK 57) · React Native 0.86.
