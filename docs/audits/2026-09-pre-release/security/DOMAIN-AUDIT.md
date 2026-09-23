# Security Audit

## Audit Metadata

- Date: 2026-09-22 (America/Chicago).
- Domain: security; domain code `SEC`.
- Mode: deep domain audit using the global `repo-audit` skill.
- Repository: `/home/bwales/projects/orbit-app`.
- Audited HEAD: `0e04c27e1d82bc3b5069bbf5adfc72281155df69` — `docs(kb): record phase 38.1 extraction`.
- Working tree was clean at initialization and remained clean before this report was written. This report is the only audit-authored file. No application, test, dependency, configuration, migration, or generated files were changed; no fixes, builds, commits, pushes, or worktrees were performed.
- Requested scope: exploitable weaknesses and unsafe trust boundaries, including authentication/authorization, secrets, network/API usage, injection, Android components and permissions, storage, dependencies, release security, and implemented versus prospective hosted/sync architecture.

## Executive Summary

The strongest finding is an unauthorized local disclosure: the widget dependency exports a permissionless image provider that serves predictably named renderings of contact names, photos, and conversational fuel to unrelated applications. Current dependency source and a retained release APK both exhibit the exposure. This is distinct from the owner's accepted choice to show fuel on the home screen.

Four further OPEN findings concern hostile input handling: unbounded backup ingestion, unsafe native share metadata assumptions, rejected photo responses that continue buffering, and unbounded Custom AI response consumption whose cancellation ownership ends too early. A sixth finding requires investigation of a narrow upgrade/restore sequence that could bind an old, previously unbound Custom API key to a replacement endpoint.

The repository has substantial positive controls: local SQLite reads, no Orbit backend or Supabase integration, SecureStore credentials, constrained SQL construction, explicit AI invocation, permission-filtered prompt readers, endpoint-bound current Custom credentials, and a state/PKCE-protected loopback OAuth callback. These do not eliminate the native component and resource-consumption defects.

Production signing remains an explicitly deferred release prerequisite. Plaintext-by-default exports, home-screen fuel visibility, and the absence of a cloud backend are recorded product/security decisions, not newly discovered defects. This audit does not change those decisions or certify a public release.

## Scope

Included application TypeScript, local Kotlin modules, Expo configuration/plugins, relevant installed native dependency implementations, lockfile/advisory data, navigation and platform entry points, AI and backup credential lifecycles, photo acquisition, SQL query construction, storage boundaries, and build documentation. Existing security reports were used for historical comparison only after checking current code.

Excluded implementation of fixes, a fresh Android build, device interaction, destructive denial-of-service demonstrations, live provider penetration testing, external account/Play Console inspection, exhaustive git-history secret scanning, and a full data-correctness audit of every table writer. Generated manifests and retained APKs are corroborating evidence, not authored source or proof of a build from audited HEAD. iOS remains deferred and was not audited as a shipping platform.

## Repository Context Reviewed

- `HANDOFF.md` §§3, 6, 9, 11 and 14: local-first privacy, no Supabase, optional future opt-in sync, Android entry points, and custom-field storage/validation intent. Later ADRs supersede the original dynamic-column model and extend the original network/export scope.
- ADR-007 and `docs/runbooks/desktop-build-pipeline.md`: desktop build transport and explicitly deferred production signing.
- ADR-012: Android automatic-backup opt-out.
- ADR-020/021 and photo code: deliberate HTTPS image acquisition followed by local storage; no network image reads required for profiles/widgets.
- ADR-037/038, ADR-040/041, ADR-043/044/045/074, and `docs/dossier/12-widget.md`: capture, notification routing, widget behavior, and accepted home-screen disclosure.
- ADR-049/051, ADR-079/107/117, ADR-135/136/137/139 and the milestone-2 AI dossier: current credential, consent, prompt, transport, and OpenRouter authorization boundaries. Earlier per-provider acknowledgement and Off Limits prompt behavior cannot be treated as current requirements.
- ADR-057/058/138/145, backup system documentation and implementation: portable full-state backups, optional encryption, previewed restoration, and secret exclusions.
- Contact import/reconciliation decisions and native picker implementation: scoped system import and deliberate READ_CONTACTS-backed reconciliation, not remote contact sync.

### Implemented versus prospective network architecture

| Surface | Current implementation and security meaning |
|---|---|
| Core contacts/dashboard/history | On-device SQLite and files; no server authentication, tenant authorization, RLS, service-role key, or server API exists to audit. Absence of those controls is not an authentication bug in this architecture. |
| Supabase/Firebase backend | No application integration found. Supabase is explicitly rejected. Transitive Android notification libraries do not establish an Orbit cloud datastore or automatic push registration. |
| AI | Implemented, optional and explicitly invoked. Direct providers/OpenRouter receive permitted prompt content. Custom supports user-configured public HTTPS services through a native transport. |
| Self-hosting | A user may host a compatible public HTTPS AI endpoint. No Orbit self-hosted server, administrative API, or deployment stack exists. LAN/local-model support and removing private-network protections are explicitly deferred/rejected. |
| OpenRouter callback | Temporary local `127.0.0.1` listener, random port, state and PKCE. No hosted callback relay; `orbit://openrouter-auth` is a credential-free wake. |
| Catalog/image acquisition | Model catalogs contain public model metadata. A pasted image URL causes a deliberate write-path download. These are implemented exceptions to an overly literal reading of the original handoff's “AI only” network wording. |
| Backups | Explicit share export and user-selected SAF storage, with foreground automatic snapshots when configured. A chosen document provider may itself be cloud-backed; this is user-controlled export, not an implemented Orbit sync service. |
| Future sync | Stable UIDs, modification times, tombstones and reconciliation support portable restores and preserve an architectural opening for sync. No scheduler, transport, remote identity, or conflict service implementing cloud sync was found. |
| Observability | Sanitized AI diagnostics exist as a local seam. Full Sentry integration is deferred; no current application telemetry upload path was found. |

## Methodology and Coverage

The audit used three independent investigative tracks (AI/network, backup/files, Android/build), followed by primary-agent adjudication and direct verification of admitted evidence against the working tree. The primary agent also inspected SQL construction, outbound handoffs, logging/secrets, dependency advisories, current decision authority, and native framework behavior. No finding is admitted solely on an investigator's summary.

Sanctioned `npm run graph:ask -- governs ...` queries were used for discovery, including query, widget, photo, backup, and AI paths. Returned governing relationships were **INFERRED** from ADR Key-files lists, not code assertions; supersession warnings led back to actual ADRs. No graph rebuild or generated-file edit occurred. Graph edges were not used to enumerate SQL writers.

Other checks:

- Read-only source/configuration searches for network calls, credentials, dynamic SQL, logging, exported components, permissions, backend/sync code, and release setup.
- Focused tracked-file secret-pattern scan returned no matching private-key blocks or sampled AWS/GitHub/OpenAI-shaped credentials. No tracked signing credential or `.env` file was identified. This is not a historical or entropy-based secret-scanner certification.
- `apkanalyzer manifest print app-release-31.1-05.apk` independently confirmed the exported widget provider without a permission and exported MainActivity. The retained artifact's name is not evidence of its source revision. The available merged debug manifest corroborates the provider declaration; authored config contains no corrective override.
- Live `npm audit --json --ignore-scripts`: **27 affected package nodes: 20 moderate, 7 high, 0 critical**. These are npm propagation counts, not 27 distinct reachable application exploits. See dependency assessment below.
- Focused existing tests, with cache disabled: **18 files, 347 tests passed**. Covered Custom URL/wrapper guards, OAuth, prompt/focus projection, API-key storage, provider guards, AI context/diagnostics/fan-out, backup schema/crypto, widget/backup linking, photo URL logic, custom identifiers, contact-method normalization, and dashboard query construction.

Test command:

```sh
node_modules/.bin/vitest run --no-cache \
  src/ai/custom-endpoint.test.ts src/ai/secure-fetch.test.ts \
  src/ai/openrouter-oauth.test.ts src/ai/message-focus.test.ts \
  src/ai/prompt-template.test.ts src/services/ai-key-store.test.ts \
  src/services/ai-service-guards.test.ts src/db/ai-context-read.test.ts \
  src/logic/ai-diagnostics.test.ts src/logic/ai-generate-variants.test.ts \
  src/services/backup/encryption.test.ts src/backup/backup-schema.test.ts \
  src/navigation/widget-linking.test.ts src/navigation/backup-share-intent.test.ts \
  src/services/photos/url-image.test.ts src/db/col-name.test.ts \
  src/logic/contact-method-normalization.test.ts src/logic/dashboard-query-logic.test.ts
```

Coverage is strongest for source-visible trust boundaries and native dependency integration. Device/OEM behavior, memory-exhaustion thresholds, live OAuth-provider behavior and final release provenance remain limited. Node tests mock important native paths; green results do not close the findings below.

## Findings Summary

**6 primary findings: 5 OPEN, 1 INVESTIGATE.** Severity: S0 0; S1 2; S2 4; S3 0; S4 0. One S1 is an investigation candidate, not a confirmed credential theft.

| ID | Finding | Severity | Confidence | Disposition |
|---|---|---|---|---|
| AUD-SEC-001 | Widget snapshots readable by unrelated apps | S1 Major | C3 Confirmed | OPEN |
| AUD-SEC-002 | Backup intake consumes unbounded provider streams and payloads | S2 Moderate | C3 Confirmed | OPEN |
| AUD-SEC-003 | Native share handler trusts malformed provider metadata | S2 Moderate | C2 Strong | OPEN |
| AUD-SEC-004 | Rejected photo responses continue native buffering | S2 Moderate | C3 Confirmed | OPEN |
| AUD-SEC-005 | Custom AI body consumption loses cancellation and has no size bound | S2 Moderate | C3 Confirmed | OPEN |
| AUD-SEC-006 | Legacy Custom key may bind to a restored replacement endpoint | S1 Major | C2 Strong | INVESTIGATE |

## Findings

### AUD-SEC-001 — Widget snapshots readable by unrelated apps

**Severity:** S1 — Major  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** SECURITY, PRIVACY  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary

The widget's bitmap ContentProvider is exported without caller authorization. An unrelated installed app can read a correctly guessed widget image containing relationship information.

#### Expected Behavior / Invariant

The app sandbox and deliberate launcher integration should limit disclosure to intended recipients. Accepting visible home-screen fuel does not authorize arbitrary apps to retrieve the image. Android's provider access rules allow unrestricted external access when an exported provider has no applicable permission or caller check. [Android provider reference](https://developer.android.com/guide/topics/manifest/provider-element)

#### Observed Behavior

The library rasterizes the entire widget, stores it under a predictable filename, and serves it through an exported provider. Orbit enables this dependency without changing that access boundary.

#### Evidence

- `package.json` pins `react-native-android-widget` to `0.22.0`; `app.config.ts` registers its widget plugin.
- `node_modules/react-native-android-widget/android/src/main/AndroidManifest.xml:4–8` declares `.RNWidgetImageProvider`, authority `${applicationId}.rnwidget.imageprovider`, `exported="true"`, and no permission.
- In the same package, `RNWidgetImageProvider.java:27–53` accepts read mode, derives a filename from the URI, checks the path/existence and returns a descriptor. It never checks the calling UID or a grant. `query()` returning null prevents listing, not guessed reads.
- `RNWidget.java:76–78` rasterizes the widget; `:148–151` produces `widget_<id>_mode_light.png` (or dark).
- `src/services/widget/widget-data.ts` carries the favourites projection's name, photo and ranked fuel into tiles. `src/services/widget/widget-render.tsx:208`, `:418`, and `:428` render photo, name and fuel respectively.
- Primary-agent APK inspection confirmed the effective provider at authority `com.bwales.orbit.rnwidget.imageprovider`, exported with no permission. The available merged debug manifest has the same declaration at lines 231–234.

#### Impact

An installed app can collect the visible contact names, photos, relationship status and fuel snippets from widget snapshots without contact/storage permission or an Orbit consent prompt. No arbitrary database/file read is claimed; the demonstrated target is widget images.

#### Trigger / Preconditions

A populated widget has rendered and its image remains present. The attacker has an installed app and knows or probes the integer widget ID; for example, `content://com.bwales.orbit.rnwidget.imageprovider/widget_37_mode_light.png`.

#### Remediation Direction

Only the intended widget host should receive access to snapshot images. Preserve functional widget rendering and the owner's chosen home-screen content while closing unrelated-app reads.

#### Verification

Inspect the final release manifest and test from an unrelated, unprivileged app: even an exact known image URI must be denied. Verify actual launcher rendering, refresh, resizing and reboot recovery still work. An adb-shell read alone is not the full attacker-app test.

#### Related Findings

Historical `docs/audits/2026-08-21/SECURITY-PRIVACY.md`, SEC-001 describes the same still-present defect; retain that identity mapping in synthesis.

#### Planning Notes

The vulnerable component is supplied by the pinned native dependency. JavaScript-only changes cannot establish provider caller authorization. A fresh native build and supported-launcher check are necessary after remediation.

### AUD-SEC-002 — Backup intake consumes unbounded provider streams and payloads

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** SECURITY, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary

The native backup receiver copies arbitrary-length external streams before restore confirmation. Subsequent text, JSON and base64 processing also allocates before meaningful size rejection.

#### Expected Behavior / Invariant

Receiving an untrusted backup must not grant its sender unbounded storage, memory or processing time. Restore preview and schema validation protect database writes, but must also be reachable safely for hostile input.

#### Observed Behavior

JSON MIME identifies the intake path; it does not bound the content. Cold/warm share handling copies into cache immediately. The screen later reads the entire file before parsing. Even the encrypted-envelope size limit is applied after allocating decoded data.

#### Evidence

- `plugins/withBackupRestoreShareIntent.js` registers `ACTION_SEND` for `application/json` and `text/json` on MainActivity.
- `modules/orbit-backup-document-picker/android/src/main/java/expo/modules/orbitbackupdocumentpicker/OrbitBackupDocumentPickerModule.kt:72–85` captures lifecycle intents; `captureBackupShare():132–145` passes the stream to `copyToCache()`.
- `copyToCache():152–157` opens the provider stream and calls `input.copyTo(output)` with no byte ceiling, deadline or cancellation. Deleting the partial file on a thrown exception does not stop an endless successful stream.
- `src/screens/BackupScreen.tsx:235–246` calls `new File(uri).text()` before validation. Its focus handler at `:268–276` consumes a staged share automatically.
- `src/services/backup/backup-service.ts:48` parses the entire string. `src/services/backup/encryption.ts:165–183` builds a number array and `Uint8Array` before checking `maximumBytes`; the envelope limit does not bound ingress allocations.

#### Impact

A malicious or broken document provider can block handling, consume app cache/storage, or exhaust memory before the user approves restoration. Database preview/transaction controls do not prevent this availability attack. No successful unauthorized database mutation is claimed.

#### Trigger / Preconditions

An app delivers an allowed JSON share with a readable hostile stream, or the user selects such a file/provider through the picker. The JSON need not be valid to consume resources. Normal Android activity-start restrictions still apply; this is not a claim of unrestricted background launching.

#### Remediation Direction

Bound bytes and time while consuming external streams, and reject oversized representations before whole-file/JSON/base64 allocations. Aborted and failed acquisitions should clean up owned temporary files and remain cancellable.

#### Verification

Use a controlled provider serving an oversized finite document, a never-ending stream, a stalled stream, misleading size metadata and a very large encrypted-field string. Verify bounded resource use, responsive cancellation, safe errors and no database change. Retest valid large backups at the supported limit.

#### Related Findings

AUD-SEC-003 shares Android ingress ownership. AUD-SEC-004 and AUD-SEC-005 share the broader missing-resource-boundary pattern but have independent implementations.

#### Planning Notes

Any size policy must account for supported backup versions, embedded photos/backgrounds and encrypted/base64 overhead. Preserve ADR-058's preview, optional encryption and fail-closed encrypted export behavior.

### AUD-SEC-003 — Native share handler trusts malformed provider metadata

**Severity:** S2 — Moderate  
**Confidence:** C2 — Strong  
**Scope:** Multi-area  
**Type:** SECURITY, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary

The installed share-intent module processes file metadata with unchecked null and cursor assumptions in its warm-intent lifecycle callback. A malformed allowed JSON share can fail in native handling before Orbit's safe restore UI takes ownership.

#### Expected Behavior / Invariant

External intents and provider metadata are untrusted even when their MIME matches an advertised filter. Missing providers, denied grants, null cursors/types and incomplete columns must produce a bounded handled failure, not an uncaught native exception.

#### Observed Behavior

Both the dedicated backup module and the general share-intent module receive new intents. The general module treats any non-text payload as a file and resolves its metadata before JavaScript can route or reset it.

#### Evidence

- `node_modules/expo-share-intent/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt:199–200`: `OnNewIntent` directly invokes `handleShareIntent`.
- `handleShareIntent():124–160` routes a JSON `ACTION_SEND` with `EXTRA_STREAM` to `getFileInfo()` as a non-text file.
- `getFileInfo():69–75` force-unwraps `resolver.query(...)`, assumes a first row and DISPLAY_NAME/SIZE columns, and force-unwraps `resolver.getType(uri)`. It has no encompassing exception handler. The separate `getAbsolutePath()` catch does not protect these earlier operations.
- Expo's `AppContext.kt:360`, `ModuleRegistry.kt` payload `post()`, `ModuleHolder.kt:115–117`, and `events/EventListener.kt:24–25` dispatch that lifecycle body directly without the async-function promise rejection boundary.
- `src/navigation/linking.ts` resets/reroutes backup shares only after native dispatch; it cannot prevent the preceding metadata exception.

#### Impact

An allowed malformed share can trigger native failure and interrupt or terminate the app rather than present the generic restore error. The precise activity/process outcome remains a device verification item. No disclosure or privilege escalation is established.

#### Trigger / Preconditions

Orbit has a warm activity and receives a matching JSON `ACTION_SEND` with a nonexistent, inaccessible or deliberately malformed provider URI. This scenario deliberately uses an allowed MIME; it does not depend on bypassing modern Android intent-filter matching with an unsupported image MIME.

#### Remediation Direction

Make native share handling defensive and coordinate ownership of backup streams before file metadata is processed. Unsupported or malformed inputs should stop safely at native ingress.

#### Verification

From an ordinary foreground test app, deliver matching JSON shares with null/empty cursors, missing columns, null MIME, revoked permission and absent providers. Verify no process failure and no accidental record creation on cold and warm starts. Also verify valid text capture and backup sharing.

#### Related Findings

AUD-SEC-002. These can share an ingress remediation review, but bounded copying alone does not resolve unsafe metadata assumptions.

#### Planning Notes

The project already patches `expo-share-intent`; the installed implementation still contains these assumptions. Do not rely exclusively on manifest MIME restrictions or JavaScript error handling to validate native input.

### AUD-SEC-004 — Rejected photo responses continue native buffering

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** SECURITY, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary

The photo downloader rejects bad response metadata without cancelling the response. In the installed Expo runtime, the native response pump can keep buffering that rejected body without the accepted-image byte ceiling.

#### Expected Behavior / Invariant

A rejected image response must stop transport and release buffers. The advertised 8 MiB acquisition bound must cover rejection paths, not only an accepted response consumed through the bounded reader.

#### Observed Behavior

`fetch` has no abort signal/deadline. URL, HTTP-status and MIME checks can throw before acquiring or cancelling the reader. Expo buffers incoming bytes until streaming consumption begins.

#### Evidence

- `src/services/photos/url-image.ts:292` starts the request. At `:304–325`, invalid final URL, unsuccessful HTTP status or disallowed content type throws without cancelling the body. The capped reader is obtained only at `:352`.
- `node_modules/expo/src/winter/runtime.native.ts:41–53` installs Expo fetch by default unless the explicit RN-fetch opt-out environment variable is enabled. No repository opt-out was found.
- `node_modules/expo/android/src/main/java/expo/modules/fetch/NativeResponse.kt:140–146` starts its body pump after headers. At `:194–210`, `RESPONSE_RECEIVED` appends incoming bytes to the sink until JS streaming starts.
- `ResponseSink.kt:8–15` stores chunks in a growable list without an application byte cap. The response coroutine can continue after the caller throws; there is no prompt application cancellation on these paths.
- `src/components/PhotoSourcePicker.tsx` invokes this function only when the user submits a photo URL. `url-image.test.ts` tests MIME rejection and accepted-stream overflow, but mocks native behavior and does not establish that rejected network bodies stop.

#### Impact

A hostile HTTPS image URL returning an oversized/chunked error page or disallowed MIME can continue consuming network and native memory after Orbit reports rejection. Sustained input can cause memory pressure or process failure. An actual device memory threshold was not measured.

#### Trigger / Preconditions

The user explicitly submits an attacker-controlled HTTPS photo URL. The response fails an early policy check and continues supplying bytes. No automatic profile-read fetch or contact-data upload is involved.

#### Remediation Direction

Own transport cancellation through every exit path, with bounded time and resource use even for responses that fail validation. Preserve the deliberate HTTPS image acquisition feature and local-only rendered photos.

#### Verification

Use a controlled large/streaming disallowed-MIME and non-2xx response. Verify transport stops promptly, memory remains bounded and the UI can retry. Retest accepted images, redirects, over-cap streams and leaving the acquisition screen.

#### Related Findings

AUD-SEC-002 and AUD-SEC-005; historical SEC-004 covers related photo resource-limit concerns. This finding adds an installed-SDK-specific rejected-response path.

#### Planning Notes

Do not assume bare React Native's old fully buffered fetch is the current default: SDK57 installs streaming Expo fetch. The accepted-image stream already has an 8 MiB counter. The no-stream disk fallback, pre-decode pixel limits and cancellation during crop acquisition remain adjacent device-test concerns, not evidence that every successful current download is unbounded.

### AUD-SEC-005 — Custom AI body consumption loses cancellation and has no size bound

**Severity:** S2 — Moderate  
**Confidence:** C3 — Confirmed  
**Scope:** Multi-area  
**Type:** SECURITY, RELIABILITY  
**Disposition:** OPEN  
**Verification:** STATIC, DEVICE

#### Summary

The Custom native transport removes the request from its cancellation map as soon as headers arrive, then reads the entire response body into a string without a byte ceiling or a body-read error settlement path.

#### Expected Behavior / Invariant

The selected Custom endpoint is still an untrusted response source. Cancellation must remain effective through body consumption, allocations must be bounded, and every request must settle once with sanitized success/failure.

#### Observed Behavior

`onResponse()` calls `settle()` before reading the body. A later cancel cannot find the call. Large success or error responses are buffered completely; a read failure can leave the bridge promise unresolved.

#### Evidence

- `modules/orbit-secure-fetch/android/src/main/java/expo/modules/orbitsecurefetch/OrbitSecureFetchModule.kt:106–114`: cancellation looks up `inFlight`, while `settle()` removes both request and cancellation tombstone.
- At `:175–194`, `onResponse()` settles first, then calls `res.body?.string()` at `:184`, outside any catch that rejects the promise for body-read failure.
- `src/ai/secure-fetch.ts` awaits the native promise and only removes its abort listener in `finally`. A cancellation after headers cannot interrupt the removed call and can leave a new native tombstone behind.
- `src/services/AiService.ts:580–603` receives the already buffered body, then checks status and parses JSON. Suggestion-text limits apply after network allocation.
- Counterguards: the native client has 15-second connect, 30-second read and 45-second call timeouts; `src/logic/ai-suggestion-logic.ts:77` sets a 20-second UI timeout with stale-result suppression. These limit time/UI effects but not response size or post-header cancellation ownership.

#### Impact

A configured public HTTPS endpoint can exhaust memory with a large body; cancelled requests can continue consuming resources. A truncated/timed-out body may strand the native promise even though the UI independently times out. An ordinary `IOException` is not itself claimed to crash the process; allocation failure is a separate risk.

#### Trigger / Preconditions

The user configures a Custom endpoint and explicitly generates a suggestion; that server is malicious, compromised or returns a pathological response. This is not anonymous inbound network access to Orbit.

#### Remediation Direction

Keep transport ownership until body consumption completes, enforce a response byte bound, and settle/clean up every success, cancellation and failure once. Retain the existing HTTPS, DNS, redirect and proxy restrictions.

#### Verification

Exercise the actual native module with headers followed by a delayed body, cancellation after headers, oversized success/error/chunked bodies and truncated responses. Assert bounded memory, transport cancellation, sanitized rejection and no unresolved promise/tombstone accumulation. Mocked wrapper tests are insufficient.

#### Related Findings

AUD-SEC-002 and AUD-SEC-004 share the resource-boundary pattern.

#### Planning Notes

This is a response/lifecycle defect, not a reason to weaken ADR-051's destination controls or introduce LAN providers. Native transport tests are needed in addition to the existing shared address-vector tests.

### AUD-SEC-006 — Legacy Custom key may bind to a restored replacement endpoint

**Severity:** S1 — Major  
**Confidence:** C2 — Strong  
**Scope:** Multi-area  
**Type:** SECURITY, PRIVACY, INVESTIGATE  
**Disposition:** INVESTIGATE  
**Verification:** STATIC, RUNTIME

#### Summary

Current Custom credentials are endpoint-bound. However, an older plaintext SecureStore credential is bound on its first read to the endpoint supplied by the caller. Restore can replace endpoint metadata without first binding that old secret to its original endpoint.

#### Expected Behavior / Invariant

Portable non-secret metadata must not retarget a pre-existing credential. The normal connection editor already preserves this invariant while migrating legacy keys.

#### Observed Behavior

Legacy binding is lazy. The ordinary editor reads the previous endpoint first; restore directly writes the new endpoint. A device upgraded with an unread legacy key can therefore potentially bind it to the restored recipient when AI is next resolved or invoked.

#### Evidence

- `src/services/ai-key-store.ts:144–159`: a versioned credential returns only on exact normalized endpoint equality; a legacy plaintext value is wrapped with the currently supplied endpoint and returned.
- `src/screens/ai-connection-logic.ts:131–140` deliberately calls `getKey("custom", previousEndpoint)` before changing metadata, including a blank-credential edit.
- `src/db/migrations/029-ai-configuration.ts` changes SQLite only and initializes AI disabled with no active connection. It does not migrate old SecureStore credentials. `src/stores/ai-config-store.ts` hydration also reads only settings/connection metadata.
- `src/backup/restore-apply.ts:598–613` directly imports `customEndpoint` and other connection metadata. `src/backup/reconciliation.ts:384–411` normalizes incoming lane identity, so a merge need not guess the local connection UID. Restore can also import portable AI settings; there is no key-binding step in that writer.
- `src/components/AIFirstUseDisclosure.tsx:40–52` reads a key only after enabled/active state exists. It therefore does not proactively migrate every dormant legacy key before restore.
- `src/services/AiService.ts:562–566` puts a returned Custom key in `Authorization`. This would occur only on a later explicit generation request.

#### Impact

If the upgrade/restore sequence is reachable as traced, the old Custom provider key could be transmitted to the replacement HTTPS endpoint, enabling unauthorized use of that credential. No ordinary bound-key bypass, automatic send or actual key exposure was demonstrated.

#### Trigger / Preconditions

An existing pre-binding plaintext Custom key remains unread; the user accepts a crafted or otherwise untrusted backup that wins endpoint metadata reconciliation; AI is later enabled/resolved and explicitly invoked against the replacement public HTTPS endpoint. Existing endpoint-bound credentials fail closed on mismatch and are not affected by this hypothesis.

#### Remediation Direction

First establish the full supported upgrade/restore sequence. If confirmed, preserve original credential-recipient binding across metadata restoration or require explicit credential reconfiguration when that provenance cannot be established.

#### Verification

Seed an actual legacy-format key in an injected SecureStore backend and the corresponding old configuration. Run migration, restore, readiness and generation in sequence with a recording transport. The old key must never appear in a request to the replacement endpoint. Include previously bound keys, AI-off/inactive legacy keys, merge/replace modes and a fresh-device restore.

#### Related Findings

AUD-SEC-002 shares the restore subsystem but is independently remediable. This is not a duplicate of that resource-limit defect.

#### Planning Notes

Keep secret values out of SQLite, backup documents, logs and test output. Do not silently discard all credentials as an assumed fix; compatibility and security posture need a concrete decision after the sequence is proven.

## Cross-Finding Patterns

1. **Native boundaries escape JavaScript guarantees.** The widget provider, native share callback and Custom response reader act before or outside JS validation/error handling. Manifest/dependency review and native tests are necessary.
2. **Validation occurs after resource acquisition.** Backup schema checks, image MIME checks and AI output validation are useful but do not consistently stop earlier stream consumption or allocations.
3. **Portable metadata can interact with nonportable secrets.** The legacy-key candidate crosses backup reconciliation and SecureStore migration. Correctness of either subsystem alone does not prove safe recipient binding.

## Reviewed Areas With No Material Findings

- **Application authentication and authorization model:** single-user local app, not a multi-tenant service. No login bypass, missing RLS policy or exposed service-role key applies to the implemented architecture. OS sandbox boundaries matter; the widget exception is separately reported.
- **SQL and injection:** examined dashboard/search/filter builders, system-rule resolution, normalized custom fields, settings column mapping, contact-method normalization and restore SQL. Runtime values use parameters and runtime selections choose closed SQL fragments. No exploitable SQL injection was established in these reviewed paths. This is not a blanket assertion about every writer in the repository.
- **Outbound links/communication:** `LinksEditor.normaliseLinkUrl()` limits launches to web schemes; Memory/Fuel link actions reuse it. Email handoff separately encodes recipient, subject and body. Phone actionability is derived by the shared parser. Native handoff does not itself claim a message was sent. No WebView/HTML evaluator or AI tool-execution path was identified.
- **Credential storage:** AI keys and backup passphrases use SecureStore, not SQLite/AsyncStorage/export models. Current Custom keys compare the complete normalized endpoint before returning a key. Separate provider items avoid cross-provider key selection. The narrow legacy exception is AUD-SEC-006.
- **AI prompt readers:** reviewed projections enforce per-memory, per-field and interaction-note permissions; Off Limits and Group Notes are excluded from prompt construction. Focus is intersected with currently permitted context. Generated text requires user choice; it does not execute tools or send messages. All-writer provenance of every stored consent flag was not exhaustively verified.
- **OpenRouter OAuth:** cryptographic state and PKCE, exact callback validation, one active loopback attempt, bounded callback parsing/cleanup, and a credential-free custom-scheme wake. No hosted callback, credential-bearing deep link or missing-state acceptance was found.
- **Custom destination guard:** common private/loopback/link-local/ULA/CGNAT ranges, mapped IPv4 and NAT64-private forms are checked; native DNS answers are vetted before connection, proxies disabled and redirects refused. The approved enumeration has a documented completeness caveat below.
- **Backup cryptography:** approved PBKDF2-HMAC-SHA256 profile (600,000 iterations), AES-256-GCM, random salt/IV, authenticated metadata, exact profile matching and generic authentication errors. Encryption enabled with an unavailable passphrase fails closed. No cryptographic break was established; allocation limits are separately reported.
- **File paths:** reviewed photo/background storage and restoration use constrained relative namespaces and app-derived target paths. Restore stages embedded bytes rather than trusting arbitrary serialized destination paths. No arbitrary-file overwrite/read was demonstrated in those paths.
- **Notifications and navigation:** strict known-route/positive-safe-ID parsing, lifecycle checks, navigation rather than arbitrary command execution; non-exported notification/boot/widget receivers; deterministic notification action identities. Private notification channels are the default and public display is explicit. No direct anonymous deep-link database mutation was established.
- **Permissions/backup:** camera and microphone are disabled in picker configuration; READ_CONTACTS is a deliberate reconciliation decision. `allowBackup=false` is configured. Installed SecureStore Android 12+ rules include only shared preferences and exclude SecureStore; the suspected automatic database/device-transfer inclusion was not supported by those rules.
- **Logging and secrets:** production Logger defaults off and no live application level-enabler was found. AI diagnostics use a sanitized schema. The focused present-tree secret scan found no material credential. No active analytics/crash-content upload path was found.

### Dependency and release assessment

The live registry scan reported affected `image-size`, `@xmldom/xmldom`, `js-yaml`, `uuid`, `decode-uri-component`, Vitest/mocker and their parents. Expo's production dependency classification includes development/build tools; that classification alone does not establish inclusion in the Android runtime attack path.

`decode-uri-component` has a malformed-percent decoding DoS advisory. The audited app's NavigationContainer has no general `linking` prop and its widget parser uses anchored route expressions; no path from an incoming Orbit link to that vulnerable decoder was established. [Maintainer advisory](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr)

Metro image parsing, XML/plist/config parsing and test tooling remain relevant build surfaces. The scan is a non-green dependency-maintenance signal; it is not evidence that every listed CVE is exploitable by a contact/backup payload. The final dependency review should establish affected-version reachability and use compatible updates, not blindly accept npm's suggested major downgrades. Native manifest defects such as AUD-SEC-001 are not captured by that registry count.

The lockfile pins dependencies and the documented desktop pipeline uses `npm ci`. Production signing, final certificate custody, final manifest assertions and exact source-to-artifact provenance remain release work. No new release APK was produced or certified here.

## Accepted / Deferred / Rejected Candidates

| Candidate | Disposition and authority |
|---|---|
| Plaintext SQLite / no cloud E2E encryption | **ACCEPTED architecture:** HANDOFF §§3/9/11 and ADR-012 rely on the local app sandbox. No root/unlocked-device protection requirement was invented. |
| Plaintext-by-default backup | **ACCEPTED:** ADR-058 explicitly rejects mandatory encryption. User-directed external storage is a chosen boundary; enabled encryption must still fail closed. |
| Fuel visible on the large home widget | **ACCEPTED:** `docs/dossier/12-widget.md:26–29` explicitly accepts glance exposure with no privacy control. Does not accept AUD-SEC-001's unrelated-app reads. |
| Debug-keystore signing of development release proofs | **DEFERRED production concern:** ADR-007 Risks and desktop build runbook. Public distribution needs production signing; this report does not reclassify the documented development process as an unapproved defect. |
| Supabase, hosted Orbit AI proxy, LAN AI, general sync | **REJECTED/DEFERRED:** HANDOFF §3, ADR-051/139 and milestone-2 AI dossier. No missing backend/auth implementation finding is warranted. |
| Full Sentry installation | **DEFERRED:** milestone-2 AI dossier. Current sanitized local diagnostic seam is not telemetry egress. |
| “Any restored endpoint steals any saved Custom key” | **FALSE-POSITIVE:** current versioned credentials compare endpoint equality. Only the legacy-key sequence remains under AUD-SEC-006. |
| “SDK57 always fully buffers accepted photos before size checks” | **FALSE-POSITIVE:** Expo installs streaming fetch by default. AUD-SEC-004 instead follows the actual early-rejection/native-buffer path. |
| Database automatically included in Android 12+ transfer by SecureStore rules | **FALSE-POSITIVE on inspected rules:** their explicit include domain is shared preferences, not database/files. OEM/final-artifact verification remains limited. |
| IPv6 guard is an exhaustive public-address oracle | **APPROVED ENUMERATION / CLARIFICATION:** both tables omit deprecated `fec0::/10`; the old plan mandates an exact table and Phase-14 reviews record owner adjudication of exhaustiveness. Do not imply the tests prove all possible address policy. Widening the approved table/posture requires owner consideration; no reachable TLS/routing exploit was demonstrated here. |

The IPv6 authority is `.planning/milestones/v1.0-phases/14-ai-message-suggestions/14-01-PLAN.md:75–95` and `14-REVIEWS.md:28–53`. The owner explicitly rejected adding permissive globally reachable carve-outs; that rejection must be preserved. Approval of the enumerated implementation is not a claim that the owner individually analyzed every omitted prefix.

## Coverage Limitations / Follow-up Investigation

- No attacker-app/provider PoC, device memory-pressure test, OEM backup-transfer test or final release build was run. Do not equate retained APK corroboration with current-HEAD release verification.
- AUD-SEC-006 needs an integrated upgrade/restore/transport reproduction. Current tests prove ordinary endpoint binding, not the complete legacy sequence.
- Consent enforcement was traced through prompt readers and consumers, but not every writer of contacts, memories, interactions and restored consent flags. A complete writer-level privacy invariant is outside the evidence established here.
- Photo decoded-dimension limits and the no-stream native fallback deserve device coverage alongside AUD-SEC-004. The former is not proven safe merely because compressed bytes are capped; the latter validates one response then refetches. No decoder exploitation or redirect exfiltration was demonstrated.
- Widget PendingIntents remain reusable and mutable in the dependency. A hostile authorized launcher could invoke capabilities it legitimately holds; the prior audit's replay concern needs an explicit host-trust/freshness contract and device verification before prescribing one-shot behavior that could break repeated real taps. This is distinct from arbitrary-app bitmap reads.
- Custom-scheme widget navigation uses an implicit external launch in the dependency; a competing handler may intercept navigation. No credential-bearing URI was found. Package targeting and launcher interaction can be evaluated during native hardening without changing the chosen URI UX.
- Screenshots/Recents and the absence of a separate app lock were not promoted into defects without a current requirement forbidding them. Any change is an owner security/UX posture decision.
- The present-tree secret scan and npm advisory scan do not inspect remote build-machine secrets, private signing stores, all git history, unpublished vulnerabilities or the complete native dependency CVE ecosystem.
- Stable IDs/tombstones are not authentication. If future sync or hosted services are authorized, their authentication, authorization, recipient consent and encryption boundaries require a new architecture/security review; this audit does not approve that expansion.
