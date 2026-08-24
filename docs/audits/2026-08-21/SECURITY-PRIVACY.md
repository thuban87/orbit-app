# Orbit security and privacy audit

Date: 2026-08-21  
Scope: repository and the locally available Android release/debug artifacts  
Mode: read-only review; this report is the only file written by this audit

## Executive verdict

Orbit's in-app data layer is substantially safer than a typical early-stage mobile app: contact data is stored locally, SQL values are bound, dynamic identifiers are allowlisted, writes are serialized and transactional, backup is disabled, notification content is deliberately sparse, and the dormant AI code has no production caller. I found no live analytics, telemetry, crash-reporting, remote backend, hard-coded credential, arbitrary SQL injection path, photo path traversal, or live AI egress.

The current Android widget build is **not ready for distribution** until SEC-001 is fixed. The merged Aug 17 release APK exposes the widget's rendered PNGs through an unpermissioned exported provider. Any installed app that guesses a predictable widget filename can read the snapshot; a large snapshot contains contact names, photos, and conversational fuel. This is a direct violation of the otherwise strong local-first boundary.

The artifact named `app-release.apk` is also signed by the Android debug certificate (SEC-002). It is not marked debuggable, but it must not be shipped or treated as an update-capable production artifact. Other significant risks are replayable widget actions, incomplete resource bounds on remote image intake, and the product decision to put conversational fuel on a launcher-owned surface.

The release dependency gate is also not green: a later online `npm audit --omit=dev --json` found 17 affected package nodes (10 High, 7 Moderate). Those counts are propagation through the Expo/Metro graph, not 17 distinct app-runtime exploits; the distinct advisories currently reduce to two `image-size` infinite-loop DoS issues in Metro/build processing and one `uuid` bounds issue in Xcode/config tooling. The companion architecture report owns the failing release-gate findings as ADI-006/ADI-007, so the SEC finding count below is unchanged.

Finding count: **0 Critical, 1 High, 4 Medium, 6 Low, 1 Informational**.

| Priority | Finding | Disposition |
|---|---|---|
| Release blocker | SEC-001 — exported widget bitmap provider | Fix before any widget-capable build is distributed |
| Release blocker | SEC-002 — release artifact uses debug signing key | Establish and verify production signing before distribution |
| Before wider testing | SEC-003 — replayable widget mark actions | Make action authorization one-shot |
| Before wider testing | SEC-004 — remote-photo resource limits | Add time, transfer, and decoded-pixel bounds |
| Owner security-posture decision | SEC-005 — fuel text on home widget | Redact by default or add explicit informed opt-in |

## Scope, method, and limitations

I read `CLAUDE.md` and `HANDOFF.md` in full before inspecting implementation. The review followed concrete writers and consumers across:

- SQLite bootstrap, migrations, schema, transactions, DAOs, dynamic custom-field SQL, purge, and file cleanup;
- photo picker, pasted-URL download, crop/decode, storage, and widget thumbnails;
- notifications, headless tasks, Android channels, widget rendering/actions, boot receiver, deep links, share target, and SMS/link handoff;
- AI providers, prompt construction, logging, settings types, and runtime call sites;
- Expo configuration, local config plugins, installed Android manifests/native sources, `package.json`, `package-lock.json`, patches, and build artifacts;
- secret patterns, network call sites, analytics/crash-reporting packages, permissions, exported components, backup behavior, and release signing.

The audit used actual files on disk, including installed dependency sources. It also directly inspected the untracked, gitignored artifacts `app-release.apk` (151,424,230 bytes; 2026-08-17 21:17) and `app-debug.apk` (305,048,273 bytes; 2026-08-17 21:36). `apkanalyzer` confirmed the release APK's merged manifest; `apksigner` confirmed both artifact signatures.

Limitations:

- Generated `android/` and `ios/` projects are intentionally absent/ignored, so native source-generation and Gradle signing configuration cannot be reviewed in-repo. The release APK partially closes that gap for Android as built on Aug 17, but it is a point-in-time artifact.
- No attached Android device was available in this sub-review, so the ContentProvider PoC, launcher PendingIntent behavior, lock-screen behavior, and OS-specific picker behavior remain device-verification items.
- The first dependency scan was offline and returned no locally cached advisories. A subsequent online `npm audit --omit=dev --json` did reach the registry and failed with 17 affected package nodes (10 High, 7 Moderate, 0 Critical). The discrepancy demonstrates that offline-zero was a cache limitation, not a clean bill of health. Advisory reachability is assessed below; no exploit test against the build toolchain was performed.
- Phase 14 is planning-only. AI findings are activation gates, not claims that the current app transmits contact data.
- This is a source/configuration audit, not a formal penetration test, cryptographic review, or Play Console policy review.

## Security model and trust boundaries

### Data-flow summary

```text
User UI / headless JS
        |
        +--> app-private SQLite (contacts, notes, fuel, history, settings)
        +--> app-private document files (photo masters)
        +--> Android notification manager (generic name-only reminders; opt-in)
        +--> Android launcher / RemoteViews (widget bitmap + PendingIntents)
        +--> external SMS/browser apps (explicit user handoff)
        +--> remote HTTPS image host (only after user pastes/submits a photo URL)
        `--> future AI provider (dormant today; Phase 14 must add consent/key controls)

External apps
        +--> exported MainActivity via text/plain share and orbit:// links
        `--> exported widget image provider (SEC-001: unintended read boundary)
```

### Trust boundaries

| Boundary | Data crossing it | Current control | Main residual risk |
|---|---|---|---|
| App JS ↔ SQLite/documents | All relationship data and photos | App sandbox; `allowBackup=false`; bound values; guarded relative paths | Root/unlocked-device compromise; plaintext at runtime |
| External app ↔ share target | Arbitrary plain text/title/URL | `text/plain` only; user must pick a contact before a write | Oversized/untrusted text remains UI input |
| OS/notification shade ↔ app | Contact name and opaque IDs | Opt-in; private channel by default; no fuel/note body | OS notification history and a locally compromised device |
| Launcher/widget host ↔ app | Rendered favourites, click tokens | Non-exported widget receiver; positive ID guard | Exported image provider, replayable tokens, inherently launcher-visible data |
| Remote image host ↔ app | User-submitted HTTPS URL/image bytes | HTTPS and redirect re-check; raster MIME allowlist; 8 MiB logical cap | Time, transient-disk, and decoded-pixel bounds incomplete |
| Future AI provider ↔ app | User-selected contact context and API key | No runtime caller today | Must add secure key storage, HTTPS enforcement, preview/consent, and log redaction |
| Dependency/build chain ↔ release | Native code, manifests, signing | Lockfile v3 with integrity hashes; `npm ci`-compatible | Large transitive graph; native install scripts; debug-signed release artifact |

### STRIDE view

| Threat | Result |
|---|---|
| Spoofing | Custom `orbit://` links are unverified and widget navigation is sent as an implicit intent (SEC-006). Incoming links are strictly parsed and cannot directly write. |
| Tampering | A widget host can replay a mark PendingIntent; Orbit records each delivery as a new interaction (SEC-003). DAO writes themselves are transactionally guarded. |
| Repudiation | Widget replay is indistinguishable from genuine repeat taps because each delivery mints a fresh UID. Notification actions, in contrast, have deterministic idempotency keys. |
| Information disclosure | Exported widget PNGs are readable by other apps (SEC-001); fuel is intentionally placed on a launcher surface (SEC-005); screenshots/recents remain available (SEC-011). |
| Denial of service | Remote images lack time and decoded-pixel bounds (SEC-004); database bootstrap has a rare parallel-open race (SEC-010). |
| Elevation of privilege | No code-execution or privilege-escalation route was found. The provider issue is an unauthorized read, not arbitrary filesystem access: its canonical-path check confines reads to the widget image directory. |

## Severity rubric

- **Critical** — remotely or broadly reachable compromise of all app data, arbitrary code execution, signing-key compromise, or destructive loss without meaningful user/prerequisite barriers.
- **High** — direct unauthorized access to sensitive relationship data or high-impact tampering from an ordinary installed app, or a release condition that makes compromise likely.
- **Medium** — meaningful confidentiality, integrity, or availability impact with a local/prerequisite trust boundary, explicit feature interaction, or release-only condition.
- **Low** — constrained reachability/impact, rare failure state, or concrete defense-in-depth gap.
- **Informational** — dormant code, residual risk, or pre-activation requirement with no current exploit path.

## Findings

### High

#### SEC-001 — The widget bitmap ContentProvider is exported without a permission

**Type:** Proven vulnerability; release blocker when the widget is enabled.

**Evidence and reachability:**

- Orbit pins `react-native-android-widget` 0.22.0 at `package-lock.json:7251-7254` and enables its config plugin at `app.config.ts:146-156`.
- The installed library manifest declares `RNWidgetImageProvider` with `android:exported="true"` and no `android:permission`, `android:readPermission`, or `android:writePermission`: `node_modules/react-native-android-widget/android/src/main/AndroidManifest.xml:4-8`.
- The Aug 17 `app-release.apk` merged manifest directly confirms the effective component: `com.reactnativeandroidwidget.RNWidgetImageProvider`, authority `com.bwales.orbit.rnwidget.imageprovider`, `android:exported="true"`, and no permission attribute. This upgrades the result from plugin-source inference to release-artifact confirmation.
- The provider's `query()` returns `null`, so it does **not** offer an enumeration API: `node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget/RNWidgetImageProvider.java:56-66`.
- Enumeration is not required. The renderer saves predictable names `widget_<appWidgetId>_mode_<light|dark>.png`: `node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget/RNWidget.java:148-151`. Widget IDs are integers and failed/successful `openFile` calls form an existence oracle.
- `openFile()` accepts any caller in read mode, takes the last URI segment as the filename, confirms it exists under `files/widget_images`, and returns a read-only descriptor: `RNWidgetImageProvider.java:26-54`. The canonical-path check correctly limits the directory, but there is no caller authorization.
- The stored PNG is the complete rendered widget: the library draws the root view and persists it at `RNWidget.java:76-94,137-151`. Orbit's large tile draws `tile.name` and `tile.fuelText` at `src/services/widget/widget-render.tsx:416-431`; photo thumbnails are also rendered at `widget-render.tsx:205-213`.

**Exploit scenario:** A normal installed app loops over plausible widget IDs and tries, for example, `content://com.bwales.orbit.rnwidget.imageprovider/widget_37_mode_light.png`. If the user has placed Orbit's widget and that ID exists, Android allows the read without prompting. The caller obtains a screenshot containing favourite names/photos and, in the large layout, the ranked conversational-fuel line. It does not need root, storage permission, or Orbit UI interaction.

**Impact:** Direct cross-app disclosure of third-party relationship data. This breaks the local-first promise even though SQLite and source photos remain inside the app sandbox.

**Remediation:** Patch or upgrade the widget library before release. The replacement design must make the provider non-public by default and grant read access only to the actual widget host for the specific URI, or avoid a broadly exported provider by delivering bitmaps through a host-scoped mechanism. If an exported provider is unavoidable, authorize callers against current app-widget hosts and use high-entropy, per-render, expiring filenames; predictable names alone must not be the access control. Add a release-manifest assertion that this provider is absent or protected. Treat redacting fuel (SEC-005) as defense in depth, not a substitute for fixing the provider.

**Practical verification:**

```bash
# Confirm the effective release manifest, not only dependency source.
apkanalyzer manifest print app-release.apk \
  | sed -n '/RNWidgetImageProvider/,+5p'

# On a test device, place the widget and inspect its appWidgetId.
adb shell dumpsys appwidget | rg -n 'com\.bwales\.orbit|appWidgetId'

# The current build should return a PNG for a real id. This writes only to /tmp.
adb exec-out content read \
  --uri 'content://com.bwales.orbit.rnwidget.imageprovider/widget_<ID>_mode_light.png' \
  > /tmp/orbit-widget.png
file /tmp/orbit-widget.png
```

For attacker-equivalent confirmation, use a small unprivileged test app and call `ContentResolver.openInputStream()` over a bounded ID range; do not grant that app any permission. After remediation, every non-host caller must receive `SecurityException`/denial even when it knows the exact existing URI. Because no device was attached during this sub-review, the commands above are a required verification, not a claimed executed PoC.

### Medium

#### SEC-002 — The Aug 17 release artifact is signed with the Android debug key

**Type:** Proven release-artifact weakness; release blocker for that artifact, not proof that a production signing key is absent elsewhere.

**Evidence:**

- `app-release.apk` is an untracked/gitignored Aug 17 artifact; in-repo `android/`/Gradle signing configuration is absent by design (`.gitignore:13-15,21-32`).
- SDK `apksigner verify --verbose --print-certs app-release.apk` reports signer DN `CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US`, SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- `app-debug.apk` has the same signer and digest. `apkanalyzer manifest debuggable app-release.apk` returns `false`; this is a release-mode binary signed by the debug identity, not merely a mislabeled debuggable flag.
- The APK verifies under v2 signing. With minSdk 24, absence of v3/v4 is not itself reported as a vulnerability here; the debug identity is the problem.

**Failure scenario:** If this APK is distributed as production, update trust is anchored to a developer debug keystore. Debug keystores are operationally weak, usually machine-local and poorly protected, and cannot be replaced later without Android signing-key migration or reinstall. Loss or copying of that keystore lets its holder sign accepted updates.

**Impact:** Production update-channel integrity and release continuity are not acceptable for public distribution.

**Remediation:** Create a dedicated production upload/app-signing key under an owner-approved custody and recovery process; never place it in the repository. Make the release pipeline fail if the signer DN/digest equals the known debug certificate, if `android:debuggable=true`, or if the expected production certificate digest does not match. Record the expected **public certificate digest**, not private material, in release documentation/CI. Rebuild and rerun `apksigner` before distribution.

#### SEC-003 — Widget mark actions are replayable and intentionally create a new history row per delivery

**Type:** Proven integrity weakness with a malicious/compromised launcher prerequisite.

**Evidence and reachability:**

- Direct widget clicks receive a `PendingIntent.getBroadcast` created with `FLAG_MUTABLE | FLAG_CANCEL_CURRENT`, but not `FLAG_ONE_SHOT`: `node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget/RNWidget.java:202-215`.
- The explicit receiver is non-exported in generated config (`node_modules/react-native-android-widget/app.plugin.js:95-130`), which blocks ordinary direct broadcasts, but the launcher legitimately receives the creator-authorized PendingIntent token.
- Orbit validates that the delivered contact ID is a positive safe integer before writing: `src/services/widget/widget-task-handler.tsx:83-98`. This prevents malformed IDs but does not authenticate intent freshness.
- Every accepted delivery deliberately mints `newUid()` and inserts a distinct interaction: `src/services/widget/widget-mark.ts:46-61`. There is no nonce consumption, deduplication window, or replay record.

**Exploit/failure scenario:** A third-party launcher holding the tile PendingIntent repeatedly sends the same valid token. Each replay passes the ID guard and records another `source='widget'` touchpoint, moving `last_contact` and changing derived status. Mutability also unnecessarily permits fill-in data; replay alone is sufficient for the demonstrated integrity failure.

**Impact:** Falsified relationship history, misleading recency/status, and notification suppression. The attacker must be the active/authorized widget host or compromise it, so this is not an arbitrary-app broadcast issue.

**Remediation:** Patch/upgrade the native library to minimize PendingIntent mutability and use a one-shot or, preferably, app-private single-use action token. Bind each rendered action to `{widgetId, contactId, action, randomNonce}`, store only a hash/app-private record, and atomically consume it with the write. Re-render to issue a fresh token. Retain the current positive ID validation and DAO transaction. Add a device test that sending the exact same PendingIntent twice yields one interaction.

#### SEC-004 — Remote photo intake lacks complete time, transfer, and decoded-pixel bounds

**Type:** Proven availability weakness; user must explicitly submit/pick the hostile image.

**Evidence and reachability:**

- The URL flow is live from `PhotoSourcePicker`: user submit calls `downloadImageToCache` at `src/components/PhotoSourcePicker.tsx:194-243`.
- Submitted and redirect-final URLs are HTTPS-only and MIME is raster-allowlisted, which is good (`src/services/photos/url-image.ts:131-139,298-325`). The streaming path stops above 8 MiB (`url-image.ts:194-217`).
- Neither `fetch(url)` nor `File.downloadFileAsync` has an abort signal/deadline: `url-image.ts:289-295,241-247`.
- On RN runtimes without a readable response stream, the native fallback downloads the entire body to disk and only then checks 8 MiB; the implementation explicitly documents this tradeoff at `url-image.ts:219-259`.
- The crop screen tries to decode the original immediately through Skia (`src/screens/CropPhotoScreen.tsx:116-122`). The delayed fallback and final pipeline both use image manipulation that must decode the source (`CropPhotoScreen.tsx:170-195`; `src/services/photos/photo-pipeline.ts:76-94`). No compressed-image dimension/pixel-count ceiling is enforced before those decodes.

**Exploit/failure scenario:** A URL server stalls headers/body indefinitely, streams a very large response on the native fallback, or serves an under-8-MiB highly compressed image with extreme dimensions. After the user submits the URL, Orbit can hold the operation indefinitely, consume cache/disk until the transfer completes, or crash/OOM during native decode. A malicious file selected through the picker reaches the same decode risk.

**Impact:** User-triggered app hang/crash, transient disk exhaustion, or repeated denial of service. No arbitrary file read or code execution was found.

**Remediation:** Add a wall-clock timeout/abort for header and body phases; replace the no-stream fallback with a native transfer that enforces bytes while streaming; cancel/close any unused response before a fallback refetch; inspect image magic and dimensions with a bounded parser before full decode; enforce width, height, and total-pixel ceilings; and request native downsampling during decode rather than after allocating the full bitmap. Test stalled, chunked, redirect, oversized, and decompression-bomb fixtures on the supported Pixel/Android range.

#### SEC-005 — The large home widget exposes conversational fuel by default

**Type:** Proven privacy exposure, but primarily a defense-in-depth/product security-posture decision rather than an access-control vulnerability.

**Evidence:**

- The widget data shaper copies the dashboard's ranked `fuelText` into each tile: `src/services/widget/widget-data.ts:57-69,79-90`.
- The large layout renders the contact name and that fuel text directly: `src/services/widget/widget-render.tsx:416-431`.
- The library rasterizes the whole tree into a PNG handed to the launcher: `node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget/RNWidget.java:76-94,137-151`.
- The widget configuration describes favourites “at a glance” but exposes no privacy/redaction setting: `app.config.ts:39-55`.

**Failure scenario:** A user adds a favourites widget expecting names/status/actions. Resizing to the large layout also displays a conversational-fuel line, which may contain sensitive notes about a third party. Anyone viewing the unlocked home screen and the launcher process itself receives that content. This is true even after SEC-001 is fixed; widgets inherently cross into a host/at-a-glance surface.

**Impact:** Shoulder-surfing, launcher-level disclosure, screen capture/backup by third-party launchers, and a mismatch between “favourite contact” and “safe to display their note on my home screen.”

**Remediation:** Preserve the decided favourites-grid widget, but make its default payload names/photos/status only. Put fuel display behind a separate explicit in-app opt-in with a representative preview and a warning that the launcher/home screen receives it. Consider per-contact eligibility and a “hide sensitive text” global control. This requires owner approval because it changes a visible product behavior.

### Low

#### SEC-006 — Widget navigation uses an interceptable custom-scheme implicit intent

**Type:** Proven defense-in-depth weakness with user-tap and competing-handler prerequisites.

**Evidence:** Orbit registers the unverified custom scheme at `app.config.ts:65-67`. Tiles emit `orbit://contact/<id>` and `orbit://compose/<id>` at `src/services/widget/widget-render.tsx:443-457`. The dependency handles `OPEN_URI` with an implicit `ACTION_VIEW` and no package/component restriction at `node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget/RNWidgetProvider.java:132-139`.

**Scenario/impact:** Another installed app registers the same scheme and becomes the chosen/default handler. A widget tap can reveal the contact ID and route the user into a phishing UI instead of Orbit. Android may show a chooser, and no contact body is embedded in the URI, limiting impact.

**Remediation:** Make widget-originated internal navigation explicit to `com.bwales.orbit`/MainActivity (or patch the library to call `setPackage(context.getPackageName())`). Keep the strict inbound parser at `src/navigation/widget-linking.ts:87-153`. Use verified HTTPS App Links only if genuinely external deep links are later required.

#### SEC-007 — A failed canonical photo deletion is swallowed and never retried

**Type:** Proven erasure-integrity gap; rare filesystem failure required.

**Evidence:** `deletePhoto` catches and logs filesystem errors without returning failure: `src/services/photos/photo-storage.ts:196-210`. The purge adapter wraps it in another try/catch that therefore cannot detect ordinary delete failures: `src/services/photos/purge-photo-cleanup.ts:46-53,62-99`. Launch reconciliation handles `.tmp`/`.bak` swap remnants, not canonical photo files whose DB owner is gone (`photo-storage.ts:213-225`).

**Scenario/impact:** “Delete permanently” commits all SQLite deletion, but an I/O failure leaves `avatars/contact-<id>.jpg` or a custom photo master indefinitely in app-private storage. It is not normally readable by other apps, yet it survives the user's erasure action and remains recoverable on a rooted/forensic device.

**Remediation:** Persist a post-commit erasure journal/tombstone containing derivable paths, have deletion return a verifiable result, and retry on launch until each file is confirmed absent. Keep the DB transaction separate from filesystem I/O, as currently decided; the retry journal is the bridge, not a long-running FS call inside the SQLite transaction.

#### SEC-008 — The merged release permission/native surface is broader than the implemented local-only feature set

**Type:** Proven manifest hardening issue; no current privilege abuse or FCM egress was found.

**Evidence:** The Aug 17 release APK declares `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` through API 32, `SYSTEM_ALERT_WINDOW`, FCM/C2DM/network-state/wake-lock/foreground-service permissions and services, plus numerous launcher badge permissions. Installed source shows the legacy storage declarations in `node_modules/expo-image-picker/android/src/main/AndroidManifest.xml:3-8` and `node_modules/expo-file-system/android/src/main/AndroidManifest.xml:1-6`; app config blocks camera and microphone but not storage at `app.config.ts:95-103,128-131`. `SYSTEM_ALERT_WINDOW` exists in `node_modules/react-native/ReactAndroid/src/debug/AndroidManifest.xml:8`. Expo Notifications contributes FCM-capable native service declarations at `node_modules/expo-notifications/android/src/main/AndroidManifest.xml:1-12` even though Orbit's intended configuration is local-only (`app.config.ts:116-124`).

Camera and microphone are absent from the effective release manifest, `allowBackup=false` is present, the release is `debuggable=false`, and no app code requests overlay permission, broad media permission, push tokens, or a Firebase/Expo push token. This therefore remains a least-privilege/store-policy issue, not evidence that contact data is currently uploaded.

**Scenario/impact:** Unused dangerous/special permissions enlarge review and future-misuse surface, can alarm users/store review, and make local-only assurances harder to verify. FCM-capable native code also increases supply-chain/attack surface even while dormant.

**Remediation:** Add explicit Expo `android.blockedPermissions` for legacy storage and `SYSTEM_ALERT_WINDOW` after testing the system picker on all supported Android versions. Generate and diff the merged release manifest in CI. Evaluate whether the chosen notification module can exclude remote-messaging/badge pieces; if it cannot, document the dormant components and add a CI assertion that app source never calls push-token registration. Do not remove notification permissions required for the owner-decided local reminders without device validation.

#### SEC-009 — Migration bootstrap does not reject a database from a newer schema

**Type:** Proven data-integrity fail-open with downgrade/manual-restore prerequisite.

**Evidence:** The runner reads `PRAGMA user_version`, then merely filters migrations above the current version and at/below the target: `src/db/migrations/runner.ts:38-45`. It has no `current > targetVersion` rejection. `openAndMigrate` then caches the database as ready: `src/db/database.ts:107-117`.

**Scenario/impact:** If an older APK is installed through adb/developer tooling or is otherwise pointed at a database created by a newer build, no migration runs and old DAOs operate against an unknown forward schema. Normal Android versionCode downgrade protection and `allowBackup=false` make this uncommon, but it can produce silent corruption precisely where there is no remote repair.

**Remediation:** Fail closed when `user_version > TARGET_VERSION`, surface a clear compatibility error, and perform no write. Add a runner test for the future-schema case. Do not add backward migrations; this preserves the recorded forward-only decision.

#### SEC-010 — Parallel cold-start callers are not coalesced around database open/migration

**Type:** Proven availability race; a rare simultaneous foreground/headless start is required.

**Evidence:** `openAndMigrate` checks only `cachedDb`, opens a connection, migrates, and assigns the cache after all awaits; it has no cached in-flight promise: `src/db/database.ts:89-117`. Foreground startup calls it at `App.tsx:102-115`; headless notification actions call it at `src/services/notifications/notification-actions.ts:122-126`; widget render/actions call it at `src/services/widget/widget-render.tsx:144-150` and `src/services/widget/widget-task-handler.tsx:90-95`.

**Scenario/impact:** Two cold callers can both observe `cachedDb === null`, open separate connections, read the same pre-migration version, and contend while applying identical DDL. WAL/busy timeout limits damage, and the next launch can recover, but one caller can receive a table-exists/busy failure and surface a bootstrap error or lose the headless action.

**Remediation:** Cache a single in-flight `openPromise` synchronously before the first await, return it to every caller, clear it only on failure, and close a failed connection. Keep the existing per-migration transaction and busy timeout. Add a test that `Promise.all` over several opens invokes the underlying open/migrate once.

#### SEC-011 — Sensitive screens are available to screenshots and the task switcher

**Type:** Defense-in-depth gap; local unlocked-device/shoulder-surfing prerequisite and owner UX decision required.

**Evidence:** The root app renders the normal navigation tree with no foreground/background privacy overlay at `App.tsx:240-265`; `package.json:5-42` contains no screen-capture protection module. Repository-wide searches found no `FLAG_SECURE`, `preventScreenCaptureAsync`, `enableAppSwitcherProtectionAsync`, or equivalent native plugin.

**Scenario/impact:** Android may retain profile, notes, fuel, or photo screens in Recents, and a user/assistive app can capture screenshots while those screens are visible. This is standard Android behavior, not a sandbox bypass, but Orbit stores unusually sensitive third-party notes.

**Remediation:** Ask the owner to choose the posture explicitly: at minimum obscure the task-switcher snapshot when backgrounded; optionally block screenshots on the most sensitive screens or globally. If implemented, ensure accessibility, sharing, and support workflows remain usable and test process-death/background transitions.

### Informational

#### SEC-012 — AI code is dormant, but it is not safe to activate without Phase 14 controls

**Type:** Pre-activation gate, not a current vulnerability.

**Current reachability:** `src/services/AiService.ts:13-14` says the service is not wired to a screen. A non-test import/caller search found no `AiService`, `new AiService`, or `assemblePrompt` runtime consumer. Current production network egress is therefore limited to the explicit pasted-photo URL path and OS handoffs; the AI provider methods are unreachable.

**Gaps that become real on activation:**

- `AiSettings` contains API-key strings but defines no secure persistence mechanism: `src/services/ai-types.ts:30-47`.
- The custom endpoint accepts an arbitrary non-empty string and calls `fetch` without enforcing HTTPS; the type comment explicitly defers enforcement: `src/services/AiService.ts:349-383`; `ai-types.ts:44-45`.
- The full assembled prompt is emitted at debug level: `AiService.ts:131-150`. Logging defaults off (`src/utils/logger.ts:8-41`) and no runtime `setLevel` caller exists today, but this must not become a latent contact-data leak.
- Provider calls have no timeouts/abort or response-size cap: `AiService.ts:197-223,255-285,313-340,371-409`.
- Gemini places the key in the URL query string (`AiService.ts:313-320`), increasing exposure to URL-level diagnostics.
- `.gitignore:1-32` excludes signing keys but not `.env`/`.env.*`; no credential file or credential-shaped secret exists in the current repo.

**Activation requirements:** Keep the feature default-off and explicit-invocation-only; show the exact data categories/fields that will leave the device; honor the per-field `share_with_ai` decision; store keys through Android Keystore/Expo SecureStore rather than SQLite, AsyncStorage, source, or build-time public env variables; enforce `https:` before request and after redirects for custom endpoints; remove prompt/body/key logging; add deadlines and body caps; provide cancellation and key deletion; and write provider-mocked tests proving no request occurs on screen load, read, or draft edit. Do not infer consent from enabling notifications, adding a widget, or choosing a contact.

## Positive controls observed

- **Local-first core:** Network-call search found only the dormant AI providers and the explicit photo-URL fetch. No app backend, analytics, telemetry, Sentry/Crashlytics, or `expo-updates` dependency is active; the APK marks Expo Updates disabled.
- **At-rest boundary:** SQLite opens `orbit.db` in the app sandbox (`src/db/database.ts:40,96-105`), and the effective release APK has `android:allowBackup="false"`, matching `app.config.ts:77-83`. Plaintext SQLite is consistent with the recorded local-only/no-E2E decision; root/unlocked runtime access remains a residual OS risk.
- **SQL injection resistance:** Runtime values are bound. The only user-derived identifier family is `col_name`; it is allowlisted and quoted before DDL/DML (`src/db/field-ddl.ts:54-64,72-101`; `src/db/field-values-dao.ts:45-76,126-143`). Sort expressions come from closed application constants. No reachable arbitrary SQL path was found.
- **Transactional integrity:** The shared writer wraps mutex + `BEGIN`/`COMMIT`/best-effort rollback (`src/db/transaction.ts:42-56`). Migration steps atomically bump `user_version` (`src/db/migrations/runner.ts:47-67`). Permanent purge verifies archived state and explicitly deletes every owned child including `field_history` (`src/db/purge-dao.ts:165-222`).
- **Photo path safety:** Stored values are relative and match a single strict allowlist (`src/db/photo-relative-path.ts:15-38`). File builders validate positive IDs/safe custom columns (`src/services/photos/photo-storage.ts:66-108`), and persistence uses a recoverable tmp/bak swap (`photo-storage.ts:134-190`). URL intake rejects cleartext/non-HTTP schemes, rechecks the redirect-final URL, and rejects SVG/unknown image types.
- **Share boundary:** Expo is configured for `text/plain` and not `ACTION_SEND_MULTIPLE` (`app.config.ts:133-143`). Capture does not write on receipt; a user must select/create a contact before bound DAO writes (`src/screens/CaptureScreen.tsx:252-301`).
- **Deep-link input validation:** Incoming widget URIs are matched against anchored, digits-only forms and positive safe IDs; queries, fragments, encoded segments, unknown hosts, and extra paths are rejected (`src/navigation/widget-linking.ts:78-153`). The accepted action is navigation, not mutation.
- **Link opening:** User links are normalized through an `http`/`https` positive allowlist before `Linking.openURL`; dangerous schemes are converted to inert HTTPS text (`src/components/LinksEditor.tsx:65-83`).
- **Notifications:** Master notifications default off and lock-screen public display defaults off (`src/db/migrations/002-app-settings.ts:38-49,64-78`). Channels are LOW importance and private except for the explicit public opt-in (`src/services/notifications/channels.ts:43-58`). Bodies contain only a contact name, never fuel or notes (`src/services/notifications/notification-ids.ts:80-104`). Action UIDs are deterministic and SQLite-unique, providing replay resistance unlike the widget path (`notification-ids.ts:106-120`; `src/services/notifications/notification-actions.ts:105-180`).
- **Native component posture:** The effective APK has non-exported photo/file/clipboard providers, notification components, task receiver/service, widget receiver, and boot receiver. Exported system components from WorkManager/ProfileInstaller carry system permissions. MainActivity is exported as required for launcher/share/deep-link entry and share is MIME-limited. Camera and microphone permissions are absent.
- **Logging/secrets:** `Logger` defaults to `off` and no runtime level setter was found (`src/utils/logger.ts:8-41`). Focused secret scanning found no private keys, API tokens, `.env`, signing material, or `google-services.json` in the repository/worktree.

## Dependency and supply-chain posture

- `package-lock.json` is lockfile v3. It contains 668 installed package entries, all non-link entries with integrity hashes. `npm ls --all --json` exits 0 with no invalid/extraneous dependency error.
- Offline audit result: 0 Critical, 0 High, 0 Moderate, 0 Low across 668 dependencies (532 production, 114 development, 60 optional, 12 peer). This result was stale/incomplete local-cache evidence only.
- Online production-graph result: `npm audit --omit=dev --json` exits 1 with 17 affected package nodes — 10 High, 7 Moderate, 0 Critical. The 17 nodes are **not** 17 independent vulnerabilities. Most are parents/consumers whose severity is propagated from three distinct named advisories:
  - High `image-size` ICNS infinite-loop DoS, GHSA-w3rx-r6r6-pgpr;
  - High `image-size` JXL/HEIF infinite-loop DoS, GHSA-5p2g-fcmc-qvqq;
  - Moderate `uuid` supplied-buffer bounds issue in v3/v5/v6, GHSA-w5hq-g745-h8pq.
- Installed reachability is predominantly build/development tooling even though npm classifies it under the production dependency graph: `expo@57.0.13 -> @expo/metro@56.0.0 -> metro@0.84.4 -> image-size@1.2.1`, and `expo-share-intent@8.0.1 -> @expo/config-plugins@57.0.8 -> xcode@3.0.1 -> uuid@7.0.3`. Metro can process repository image assets during bundling/dev serving, so a crafted ICNS/JXL/HEIF asset introduced into the source/build input could hang a developer or CI build. The audited mobile runtime's downloaded-photo path does not import or call `image-size`; its risks are separately covered by SEC-004. `uuid` is reached through Xcode/config generation, and no production app call to its affected supplied-buffer APIs was found. This lowers current mobile-runtime reachability but does not make the failing build/supply-chain gate acceptable.
- Twenty-seven direct dependency declarations use `^`/`~` ranges, but the committed lockfile pins exact tarballs. Release automation should use `npm ci`, review lockfile diffs, and avoid regenerating the lock during a release.
- Installed packages with lifecycle scripts include `@shopify/react-native-skia`, `esbuild`, and optional `fsevents`; the root also runs `patch-package` after install (`package.json:44-51`). Execute installs in an isolated, least-privilege build environment.
- `patches/expo-share-intent+8.0.1.patch:1-12` is narrow and changes only Android share-title extraction. The identified widget provider/PendingIntent issues are currently unpatched.
- Do **not** apply npm's suggested `react-native-android-widget` downgrade to 0.17.2 blindly. It is a SemVer-major rollback from Orbit's pinned 0.22.0, crosses the implemented Expo/widget native API contract, and is not evidence that the downgraded library fixes SEC-001/SEC-003. Resolve the underlying Expo/Metro/config dependency chains through compatible, Expo-validated updates; inspect the lockfile and regenerated manifest/native output; and rerun widget tests on device. The companion architecture report tracks the Expo alignment and aggregate release gate under ADI-006/ADI-007.
- Neither the lockfile integrity checks nor the online advisory database caught SEC-001. Native manifest/source review remains required for mobile dependencies.
- Expo Notifications brings FCM-capable and badge native dependencies even though Orbit uses local notifications. There is no app-side push token call or `google-services.json`, but the release manifest surface should remain under CI diff/assertion.

## Verification performed

| Command/check | Result |
|---|---|
| `npm test -- --reporter=dot` | PASS — 83 files, 1,009 tests |
| `npx tsc --noEmit` | PASS |
| `npm run check:colors` | PASS |
| `npm audit --offline --json` | PASS from local cache — 0 advisories; later proven incomplete |
| `npm audit --omit=dev --json` (online) | **FAIL** — 17 affected nodes: 10 High, 7 Moderate, 0 Critical; three distinct named advisories in build/config chains |
| `npm ls --all --json` | PASS — dependency tree resolves |
| `apkanalyzer manifest print app-release.apk` | Confirmed min 24/target 36, `allowBackup=false`, `debuggable=false`, exported unpermissioned widget provider, legacy storage/overlay/FCM/badge surface, absent camera/mic |
| `apksigner verify --verbose --print-certs app-release.apk` | APK verifies; signer is Android Debug certificate, SHA-256 `fac61745...1033b9c` |
| `apksigner verify --print-certs app-debug.apk` | Same Android Debug signer/digest as release artifact |
| Static network/caller scan | No live AI caller; only explicit remote-photo `fetch` plus dormant AI providers |
| Focused secret/material scan | No credential/private-key pattern or credential file found |

Recommended recurring gates:

```bash
npm ci
npm test -- --reporter=dot
npx tsc --noEmit
npm run check:colors
npm audit --omit=dev --json              # online in controlled CI; must be reviewed, not auto-fixed

apkanalyzer manifest print app-release.apk > /tmp/orbit-manifest.xml
rg -n 'exported="true"|uses-permission|allowBackup|debuggable|RNWidgetImageProvider' \
  /tmp/orbit-manifest.xml
apksigner verify --verbose --print-certs app-release.apk
```

CI should additionally assert:

- no unpermissioned exported provider/service/receiver other than intentionally reviewed entry points;
- `RNWidgetImageProvider` is absent, non-exported with a proven grant design, or caller-authorized;
- `allowBackup=false`, `debuggable=false`, camera/microphone/legacy storage/overlay permissions absent unless explicitly approved;
- signer digest equals the production certificate and never the known debug digest;
- AI code has no read-path/background caller and custom endpoints cannot use or redirect to non-HTTPS URLs.

## Residual risks and unknowns

- Android app-private SQLite/photo storage is not application-layer encrypted. This is aligned with the recorded decision and `allowBackup=false`, but a rooted device, compromised OS, unlocked adb-debug environment, memory dump, or malicious accessibility/screen-capture service remains outside that boundary.
- Notification content and widgets necessarily leave the app process for OS/launcher surfaces. Private channels reduce lock-screen disclosure; they do not revoke OS notification history or a launcher's access to content it must render.
- A full device PoC should confirm SEC-001 across the supported Android/API/launcher matrix and validate the chosen provider fix without breaking widget rendering.
- PendingIntent fill-in/host behavior varies by platform/launcher; replay is sufficient for SEC-003, but mutation behavior should also be tested on the target Pixel.
- No production build recipe, protected key custody, Play App Signing configuration, SBOM, provenance/attestation, or CI manifest/signature gate is present in the repository. The Aug 17 artifacts demonstrate current output, not a reproducible release process.
- Release manifest contains FCM/Firebase initialization components without an app push-token caller. No current network egress from them was proven; capture network traffic on a clean install to validate the local-only runtime promise.
- The online advisory result is a point-in-time registry view. Build-tool reachability does not imply the bundled Android app exposes the same parser/API, but crafted repository assets or build inputs can still attack developer/CI availability. Re-run after dependency alignment and review each distinct advisory path rather than treating either “17 vulnerabilities” or “build-time only” as the final risk assessment.
- Share payloads and free-text fields have no uniform application-level length limit. Android Binder bounds share extras and writes require user action, so this was not promoted to a vulnerability; reasonable UI/storage limits would still improve resilience.
- Notification action payloads are type-cast on the headless action path rather than fully runtime-validated. Their native receivers are non-exported and notification delivery is OS-mediated; retain as defense in depth and add the same positive-safe-ID/kind/date validation used by widget/deep-link boundaries.
- Future backup/export work must receive a fresh threat model. `allowBackup=false` protects the current raw sandbox; a user-created export will create a new bearer-data boundary with encryption, integrity, redaction, and import-validation requirements.

## Closure criteria

The security posture is suitable for internal development after acknowledging the medium/low items. It is suitable for broader distribution only after:

1. SEC-001 is fixed and an unprivileged-app device test proves widget PNGs cannot be read.
2. A production-signed APK/AAB is built and the expected signer digest is enforced (SEC-002).
3. Widget action replay and remote-image resource limits are addressed or explicitly risk-accepted for the intended distribution scope.
4. The owner makes an explicit decision about conversational fuel on the home widget and screen/task-switcher privacy.
5. Expo/native dependencies are aligned through compatible upgrades, the three distinct online advisories are fixed or explicitly accepted, and the ADI-006/ADI-007 release gate passes; do not use the suggested widget downgrade as an unreviewed shortcut.
6. The final merged manifest and clean-install network behavior are re-audited from the exact production artifact.
