# Workpaper 15-backup — Backup file I/O (export/restore) platform verification

**Verified against:** Expo **SDK 57** official docs (`docs.expo.dev/versions/v57.0.0/...`), plus expo/expo `main` native source, fetched **2026-08-14**.
**Latest GA SDK at verification:** SDK 57 is current GA — `expo@57.0.12` (latest on npm), `expo@57.0.9` bumped React Native to **0.86.2**. No newer SDK is GA. Target stack per prompt: expo 57.x / RN 0.86 — this workpaper answers for 57.
**Repo state:** `orbit-app` still has no `package.json`/`src/` (docs-only pre-implementation repo). 07-photos (`storage-manipulate.md`, verified against SDK 55) already committed the photo pipeline to the **new class-based `File`/`Directory`/`Paths` API** (`Paths.document`). This workpaper stays consistent with that choice and flags exactly where backup must nonetheless reach into the legacy API.

**Scope reminder (product):** export = a single self-contained JSON file embedding contact photos as base64 (tens of contacts, a few MB). It is the ONLY backstop — `android:allowBackup="false"`, DB deleted on uninstall. User must be able to save it somewhere durable (Downloads/Drive), and restore must read one back in.

---

## Headline finding (decision-changer)

**On SDK 57, `StorageAccessFramework` (SAF) exists ONLY in the legacy API (`expo-file-system/legacy`). The new class-based API (`File`/`Directory`/`Paths`) has NO SAF, no `requestDirectoryPermissionsAsync`, no `createFileAsync`, no persisted-permission handling.** So the two export mechanisms split cleanly:

- **Share-sheet export** (`expo-sharing` + write via the **new** File API) — stays 100% on the new API, consistent with 07-photos. Best fit for manual "save/share this file."
- **Persisted-directory export** (SAF: write repeatedly into a user-picked folder without re-prompting) — **requires a `expo-file-system/legacy` import.** This is the only way to do unattended/rotating auto-backup, and it is genuinely available and durable (verified in native source, §4).

Neither is deprecated-for-removal on 57; legacy is an explicit, supported back-compat surface.

---

## 1. Writing the export to a user-chosen location on Android

### 1a. `expo-sharing` — `Sharing.shareAsync(url, options)`
**Source:** https://docs.expo.dev/versions/v57.0.0/sdk/sharing/ (page v57.0.0). Package `expo-sharing` (SDK 57 line).

- Signature: `Sharing.shareAsync(url: string, options?: SharingOptions): Promise<void>`. Options that matter on Android: **`mimeType`** ("Sets `mimeType` for `Intent`") and **`dialogTitle`**. (`UTI`/`anchor` are iOS-only.)
- `url` is a **local file URL**. Docs: "Sharing local files by URI works on Android and iOS, but not on web."
- **file:// from the sandbox works.** expo-sharing internally wraps the file in an Android `FileProvider` and hands the target app a `content://` URI — this is the module's entire purpose (it exists so you don't hit `FileUriExposedException` sharing a raw `file://`). You pass the `file://` uri you got from the new File API; expo-sharing does the `content://` conversion. Set `mimeType: 'application/json'` so the chooser offers Drive/Files/Gmail sensibly. An arbitrary `application/json` file from `Paths.document`/`Paths.cache` shares fine.
- **Gotcha (adjacent, not blocking):** the NEW File API's own `file.contentUri` property and the removed `getContentUriAsync()` had a FileProvider meta-data bug — `"Couldn't find meta-data for provider with authority …FileSystemFileProvider"` (https://github.com/expo/expo/issues/39056, now marked *outdated/accepted*). That bites only if you try to mint a `content://` yourself to hand to a raw intent. **It does NOT affect `Sharing.shareAsync`**, which owns its own FileProvider. So: share via `expo-sharing`, do not hand-roll `content://`.
- **Limitation:** the share sheet is **interactive every time** — the user picks a destination on each export. It CANNOT write unattended. It also does not return where the user saved it (returns `Promise<void>`).

### 1b. `expo-file-system` Storage Access Framework (SAF)
**Source (legacy):** https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/ (page v57.0.0, modified 2026-07-29).
**Source (new API, for the absence):** https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/ (page v57.0.0).

- **SAF is NOT in the new class API.** Confirmed by fetching the v57 `filesystem` (new) page: it exposes `File`/`Directory`/`Paths` with read/write (`write()`, `text()/textSync()`, `base64()/base64Sync()`, `bytes()/bytesSync()`) and `Paths.document`/`Paths.cache`, plus an Android-only `file.contentUri` property — but **no `StorageAccessFramework`, no `requestDirectoryPermissionsAsync`, no `createFileAsync`, no persisted-permission API.** The new page's only SAF-adjacent notes are constraints: *"On Android, SAF `content://` URIs do not support ReadWrite mode"* and *"For SAF files, this is a strict append-only mode."*
- **SAF IS in `expo-file-system/legacy`.** The v57 legacy page documents the `StorageAccessFramework` namespace: `requestDirectoryPermissionsAsync(initialFileUrl?)`, `createFileAsync(parentUri, fileName, mimeType)`, `readDirectoryAsync(dirUri)`, `makeDirectoryAsync(parentUri, dirName)`, `getUriForDirectoryInRoot(folderName)`. Writing into a SAF file uses `FileSystem.writeAsStringAsync(contentUri, contents)` (legacy) against the `content://` URI that `createFileAsync` returns.
- **Yes, it writes directly into a user-picked directory tree, and yes the permission persists** (see §4 — verified in native source, not just docs). Supported platform for the permission request: **Android 11+**.
- Import shape for backup: `import { StorageAccessFramework as SAF } from 'expo-file-system/legacy';` (or `import * as FileSystemLegacy from 'expo-file-system/legacy'`). This is a **deliberate legacy import** in an otherwise new-API codebase; call it out in the phase so a future reviewer doesn't "modernize" it away — there is no new-API equivalent to modernize to.

### 1c. Idiomatic 2026 approach — which to pick
- **Manual "save/export my backup" button → `expo-sharing`.** It is the idiomatic, least-permission, cross-target way to let the user drop a generated file into Downloads/Drive/Gmail. Write the JSON with the **new** File API to `Paths.cache` (or `Paths.document`), then `Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save Orbit backup' })`. Zero legacy imports, consistent with 07-photos. **Recommended default for the export UX.**
- **Unattended / rotating auto-backup into a fixed folder → SAF (legacy).** Only SAF can persist a directory grant and write into it later without a share sheet. Accept the single legacy import; there is no alternative on 57.
- A reasonable product shape: SAF-backed auto-backup is *opt-in* (user taps once to grant a folder), and `expo-sharing` is the always-available manual export. They are complementary, not either/or.

---

## 2. Reading a backup file back in for restore — `expo-document-picker`

**Source:** https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/ (page v57.0.0). Package current major **~14.x** (types confirmed via `expo-document-picker` build types).

- `getDocumentAsync(options?: DocumentPickerOptions)`. Options:
  - **`type`** — MIME filter, default `'*/*'`. **Can filter to `application/json`** (accepts a string or string[]). Note Android's document UI honors MIME loosely; a `.json` from Drive may surface as `application/octet-stream`, so filtering to `['application/json','application/octet-stream','*/*']` or validating by parse (not by extension) is safer than trusting the filter alone.
  - **`copyToCacheDirectory`** — Android/iOS, **default `true`.** When true the picked file is copied to the cache dir so other Expo APIs can read it immediately.
  - **`multiple`** — default `false` (restore wants a single file — leave false).
- Result: `{ canceled: false, assets: [{ uri, name, size?, mimeType?, lastModified }] }`, or `{ canceled: true, assets: null }`.
- **The returned `uri` is a CACHE copy (when `copyToCacheDirectory: true`).** Read it **promptly** — the OS can evict the cache dir. For restore this is fine: read → parse → import in one flow, right after the picker resolves. Do not stash the picker `uri` and read it "later." (The eviction risk is the same cache-lifetime caveat 07-photos already flags for picker/manipulator outputs.)
- **Large-file caveat is NOT ours.** Issue https://github.com/expo/expo/issues/30342 is about reading *big binary* files with `copyToCacheDirectory: false`. Our file is a few-MB JSON with `copyToCacheDirectory: true` (default) — well within trivial range. No documented size limit bites here.
- **Reading the JSON:** wrap the picker uri with the **new** File API and read as text: `new File(result.assets[0].uri).text()` (async) or `.textSync()`, then `JSON.parse`. The embedded photos are already base64 *inside* the JSON, so no separate binary read is needed. `.base64()` is available if ever needed but is not required for restore. Reading a few MB via `.text()` is fine; keep it off the render path (do it in the import action, not during a render).

---

## 3. New vs legacy `expo-file-system` split on SDK 57 — what backup needs, and from which API

**Sources:** https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/ (new), https://docs.expo.dev/versions/v57.0.0/sdk/filesystem-legacy/ (legacy), https://expo.dev/blog/expo-file-system (upgrade context), https://github.com/expo/expo/blob/main/packages/expo-file-system/CHANGELOG.md.

| Backup operation | API | Call |
|---|---|---|
| Write export JSON to sandbox | **New** | `new File(Paths.cache, 'orbit-backup.json').write(jsonString)` then share; or `Paths.document` if kept on-device |
| Read restore JSON | **New** | `new File(pickerUri).text()` → `JSON.parse` |
| Share sheet export | expo-sharing | `Sharing.shareAsync(file.uri, { mimeType:'application/json' })` |
| Pick file to restore | expo-document-picker | `getDocumentAsync({ type:'application/json' })` |
| **Persisted-folder auto-backup** | **Legacy** | `SAF.requestDirectoryPermissionsAsync()` → `SAF.createFileAsync(dirUri, name, 'application/json')` → `FileSystemLegacy.writeAsStringAsync(contentUri, json)` |

- The read/write calls backup needs (`write`, `text`, `base64`, `bytes`) are **all in the new API** — no legacy import for plain read/write. Confirmed on the v57 new-API page.
- **Only SAF forces the legacy import.** There is no SAF in the new API on 57.
- **Legacy is NOT removed or deprecated-for-removal on 57.** The v57 legacy page: *"The `legacy` version of the FileSystem API is included in the `expo-file-system` library. It can be used alongside the modern API for backward compatibility reasons."* No scheduled-removal statement. It is a supported surface, safe to depend on for SAF for the foreseeable SDK line — but treat it as a known future-migration risk and isolate the SAF calls behind one small module so a later removal is a one-file change.
- **Do not mix** new `Paths.document` `Directory` objects with legacy string paths in the same call. Keep the new-API write path and the legacy SAF path as separate, clearly-labeled code paths.

---

## 4. Auto/scheduled local-backup rotation feasibility — is persisted SAF real & durable?

**YES — verified at the native-source level, not merely from docs.**

**Source (native):** `expo/expo` `main`, `packages/expo-file-system/android/src/main/java/expo/modules/filesystem/legacy/FileSystemLegacyModule.kt`. In `OnActivityResult` for `requestDirectoryPermissionsAsync`:

```kotlin
val treeUri = data.data
val takeFlags = (data.flags
  and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION))
treeUri?.let {
  appContext.throwingActivity.contentResolver.takePersistableUriPermission(it, takeFlags)
}
```

- Expo's SAF **calls `contentResolver.takePersistableUriPermission(treeUri, READ|WRITE)`.** That is exactly the Android call required to make an `ACTION_OPEN_DOCUMENT_TREE` grant survive **app process death and device reboot** (per Android: without `takePersistableUriPermission`, a SAF URI becomes inaccessible after reboot on API 29+). So the directory-tree grant Expo hands back **is durable across restarts and reboots** until the user revokes it or the app is uninstalled.
- **Therefore rotating auto-backup is feasible:** grant the folder once (one interactive prompt), store the returned `directoryUri` string in the app's own settings, and on each subsequent sweep call `SAF.createFileAsync(directoryUri, 'orbit-backup-<n>.json', 'application/json')` + `writeAsStringAsync(...)` with **no further user interaction**. Rotation = enumerate existing files via `SAF.readDirectoryAsync(directoryUri)`, delete the oldest, write the new one.
- **Scheduling caveat (consistent with the DB-layer rules):** there is no OS timer we should lean on. Do the auto-backup as a **sweep at app launch** (and/or when the user backgrounds the app), same pattern the data layer uses for quarantine/history sweeps — NOT a background timer or a guaranteed-while-closed job. "Auto" here means "no per-write prompt," not "runs while the app is dead." A true while-closed scheduled job would need `expo-background-task`/WorkManager and is a separate, heavier decision — out of scope unless the owner wants it.
- **Android 11+ scoped-storage limits that DO bite:**
  - The permission request itself is **Android 11+** (per v57 legacy docs).
  - **`ACTION_OPEN_DOCUMENT_TREE` cannot grant the Download root or top-level of shared storage on Android 11+** — the system blocks selecting `Download/` (and other sensitive roots) as a tree. The user must pick a *sub*-folder (e.g. `Download/OrbitBackups` created via the picker, or any folder they make). Plan the UX around "pick/create a folder," not "we'll write to Downloads." (Cross-ref the Downloads-write limitation discussion: https://github.com/expo/expo/issues/39227.)
  - Persisted-grant **count cap**: Android limits persisted URI grants (512 on API 30+, 128 below). One folder grant for backup is nowhere near this — non-issue, noted for completeness.
  - SAF grant is to the **tree**; sub-directory traversal has historically been quirky in Expo (https://github.com/expo/expo/issues/20102 — "can only read the directory the user grants, not sub-directories"). Keep backups **flat in the granted folder**, don't nest.

---

## Decision-changing summary

1. **Pick `expo-sharing` for the manual export; keep it entirely on the new File API.** Write JSON with `new File(Paths.cache,'orbit-backup.json').write(json)`, then `Sharing.shareAsync(file.uri, { mimeType:'application/json', dialogTitle:'Save Orbit backup' })`. file:// from the sandbox is fine — expo-sharing does the FileProvider→content:// conversion itself; do NOT hand-roll a `content://` (that path hits the #39056 FileProvider-meta-data bug). (docs v57.0.0 `sdk/sharing`; issue expo/expo#39056.)
2. **SAF is legacy-only on SDK 57 — the new `File`/`Paths` API has no SAF at all.** Any "write into a user-picked folder / persisted auto-backup" feature MUST `import { StorageAccessFramework } from 'expo-file-system/legacy'`. This is a deliberate legacy import in a new-API codebase; isolate it and label it so it isn't "modernized" away — there is no new-API equivalent. Legacy is supported, not scheduled for removal on 57. (docs v57.0.0 `sdk/filesystem` vs `sdk/filesystem-legacy`.)
3. **Persisted auto-backup is REAL and durable.** Verified in Expo native source: `requestDirectoryPermissionsAsync` calls `takePersistableUriPermission(READ|WRITE)`, so the folder grant survives app kill and reboot. Grant once, store `directoryUri`, then `createFileAsync`+`writeAsStringAsync` with no further prompts; rotate via `readDirectoryAsync`. Run it as an **app-launch sweep**, not a background timer (matches the DB sweep pattern). (native: `FileSystemLegacyModule.kt`, expo/expo `main`.)
4. **Restore-read gotcha:** `getDocumentAsync({ type:'application/json' })` returns a **cache copy** (`copyToCacheDirectory` default true) that the OS can evict — read it immediately (`new File(uri).text()` → `JSON.parse`) in the import flow, never stash the uri for later. Filter MIME loosely and validate by parse, not extension (Drive may report `application/octet-stream`). A few-MB JSON is trivially within limits. (docs v57.0.0 `sdk/document-picker`.)
5. **Android 11+ scoped-storage limit to design around:** SAF cannot grant the Download root or shared-storage top level — the user must pick/create a **sub-folder**, and backups should stay **flat** inside it (sub-directory traversal is buggy). UX = "choose a backup folder," not "we save to Downloads." (docs v57.0.0 SAF Android 11+ note; issues expo/expo#39227, #20102.)

### Could NOT fully verify (flagged)
- **expo-sharing's internal FileProvider conversion of `file://`** is stated from the module's established purpose and the docs' "sharing local files by URI works on Android," not from an explicit v57 doc sentence saying "we convert file:// via FileProvider." High confidence, but **confirm on-device during the phase** by sharing an `application/json` file from `Paths.cache` to Drive/Files. (The v57 sharing doc page did not render a full code example when fetched.)
- **Whether `.copy()/.write()/.delete()` in the new class API are truly synchronous-blocking on-device** — same open item 07-photos already flagged; unchanged here.
- **A persisted SAF grant surviving a full OS *uninstall/reinstall*** — it does not (grant dies with the app), and that's fine for our purpose, but not separately re-verified. Reboot/app-kill persistence IS verified (source-level).
- The v57 sharing page's exact code example (WebFetch returned the API table but not the `<APISection>` example body). API shape is confirmed; example wording is not quoted.

**Cross-cutting note for the phase:** the export JSON embeds base64 photos, so the whole backstop is one file — but SAF writes land on shared/removable storage the user controls, i.e. **outside** the `allowBackup=false` sandbox. That is the point (it's the only off-device copy), but it means backup files are readable by anything with storage access. If the owner considers the backup sensitive, encryption-at-rest of the JSON is an owner-bucket (risk/security) decision, not something to add silently.
