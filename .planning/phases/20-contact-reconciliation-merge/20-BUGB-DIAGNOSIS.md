# Bug B Diagnosis — "Check linked contacts" bulk reconcile scan crashes

**Status:** ROOT CAUSE CONFIRMED on device (Pixel 6 Pro `1A071FDEE002BU`).
**Diagnosis only — no fix implemented. Instrumentation reverted; `git status` for `src/` is clean.**

---

## 1. The throwing contact

| Field | Value |
|---|---|
| **contactId** | **3** |
| Active links | **1** (single-link — NOT multi-link) |
| Orbit photo column | `avatars/contact-3.jpg` |
| Source situation | The source (phone) contact linked to Orbit contact 3 **has a photo**, so the scan tried to stage it. |

Contact 3 is simply the **first contact in `ORDER BY c.id` that has a source photo to stage**. The bug is **photo-staging-specific, not multi-link-specific** — the prior UAT note's multi-link suspicion was a red herring. Any source contact with a photo triggers it; the full linked set always contains at least one, so the whole scan aborts on the first.

## 2. The exact exception (verbatim from the device)

Captured by surfacing the error into the on-screen message (`uiautomator dump`), because JS `console.*` on this build routes to Metro (detached), not to `logcat` (`logcat -s ReactNativeJS:V` came back empty):

```
name = TypeError
MSG  = Cannot read property 'subtle' of undefined
PROBE = subtle=undefined digest=undefined
FRAME = TypeError: Cannot read property 'subtle' of undefined
     || at ?anon_2_digest (http://localhost:8081/index.bundle//&platform=android&dev=true&lazy=true&minify=false&app=com.bwales.orbit&modulesOnly=false&runModule=true&excludeSource=true&sourcePaths=url-server&transform.routerRoot=app&transform.engine=hermes&transform.bytecode=1&unstable_transformProfile=hermes-stable:305846:39)
     || at next (native)
```

`?anon_2_digest` is the `digest()` helper in `reconcile-photo.ts`. (The `localhost:8081` in the URL is the device-side port; via `adb reverse` it maps to the host's orbit Metro on :8082 — not related to the bug.)

**Key detail:** the message is "Cannot read property 'subtle' **of undefined**" — the value being dereferenced (`globalThis.crypto`) is itself `undefined`. It is **not** that `crypto` exists and `.subtle` is missing; `globalThis.crypto` does not exist at all in this app's Hermes runtime.

## 3. Which call threw

`stageReconcileSourcePhoto` — specifically its `digest()` helper.

- `src/screens/ReconcileGridScreen.tsx:174` — `stageReconcileSourcePhoto(firstPhoto.picked.photoTempUri, ...)` inside the `for (const contact of contacts)` loop.
- → `src/services/photos/reconcile-photo.ts:59` — `digest(await fs.readBytes(...))`
- → **`src/services/photos/reconcile-photo.ts:23-24`** — the throwing line:
  ```ts
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  ```
  `globalThis.crypto` is `undefined`, so reading `.subtle` throws the `TypeError`.

The error propagates out of the loop, into the `try/catch` at `ReconcileGridScreen.tsx:164-225` (which runs staging cleanup and re-throws), then into the `useEffect` `.catch` at `ReconcileGridScreen.tsx:229-231`, which swallows it and shows "Could not check linked contacts right now." — exactly the reported symptom, with no trace.

## 4. Root-cause hypothesis (grounded in the code)

**This app's Hermes runtime provides no global WebCrypto object: `globalThis.crypto` is `undefined`, and `reconcile-photo.ts:24` dereferences it with no guard.**

Evidence it is unguarded and unpolyfilled:
- `reconcile-photo.ts:23-28` — `digest()` calls `globalThis.crypto.subtle.digest(...)` directly, with no fallback or presence check.
- `src/db/uid.ts:19-23` — the ONLY other `globalThis.crypto` consumer **guards it**: `const cryptoObj = globalThis.crypto; if (cryptoObj && typeof cryptoObj.randomUUID === "function") {...} return fallbackUuidV4();`. That guard is why `uid` never crashed and why the authors evidently already knew `globalThis.crypto` can be absent. `reconcile-photo.ts` did not get the same treatment.
- No global crypto polyfill is installed. `react-native-quick-crypto@1.1.7` is a dependency, but it is only pulled in as a namespace via `require("react-native-quick-crypto")` in `src/services/backup/encryption.ts:62`; it is **never** installed onto `globalThis` (no `install()` call, no import in `index.ts` / `App`). So nothing populates `globalThis.crypto.subtle`.

Why the single-contact path "worked": the same `stageReconcileSourcePhoto` → `digest()` is called from `ReconcileDetailScreen.tsx:60`. It fails identically **only when the source contact has a photo**. The single-contact case the owner exercised was almost certainly on a photo-less contact (or a field other than photo), so the digest line was never reached. The grid scan hits it because the full set always includes a photo'd contact. **The same latent crash lives in the single-contact detail path** and will fire there too for any photo'd source.

## 5. Suggested fix DIRECTION (NOT implemented — owner/planner call)

Compute the SHA-256 content hash through a crypto primitive that actually exists in this runtime, instead of the absent `globalThis.crypto.subtle`. The change is localized to the `digest()` helper in `src/services/photos/reconcile-photo.ts`. Viable primitives already in the dependency tree: `expo-crypto` (an Expo dep; can digest bytes/strings to a hex string), or `react-native-quick-crypto` (already used by `encryption.ts` via `createHash('sha256')`). Whichever is chosen must emit the **same stable hex string** currently expected, because that hash is threaded through `photoContentHash` into `ReconcileSource`, the classifier's photo `sourceValue`, and the `reconcile_source_snapshot.reviewed_value` — so the same primitive must be used everywhere a photo content hash is ever computed (today that is only this one helper, so consistency is easy to preserve). Fixing only the grid without fixing the shared `digest()` would leave the identical crash in `ReconcileDetailScreen`'s staging path; the single shared helper is the right and only place to fix. Consider also mirroring `uid.ts`'s defensive posture (guard/availability check) so a future missing-primitive is a handled error, not a silent scan abort. Separately, the swallowing `.catch` at `ReconcileGridScreen.tsx:229-231` is what erased all diagnostic signal — worth logging the real error there — but that is a diagnosability improvement, not the root cause.

## 6. Evidence log

Commands run and the raw delta that mattered:

```
# device confirmed
~/.local/bin/adb devices -l
  1A071FDEE002BU  device usb ... model:Pixel_6_Pro

# log channel: cleared logcat, captured ReactNativeJS:V in background, triggered scan
~/.local/bin/adb -s 1A071FDEE002BU logcat -c
~/.local/bin/adb -s 1A071FDEE002BU logcat -s ReactNativeJS:V > logcat.txt   (background)
  -> logcat.txt stayed 0 bytes; JS console routes to Metro (detached, unreadable),
     so instrumentation was switched to surface the error into the on-screen message.

# dev-server gotcha discovered: orbit dev client requests device:8081 by default.
# Baseline reverse was 8081->8081 (quest-board), so a fresh launch loaded quest-board's
# bundle and redboxed "Cannot find native module 'ExpoWebBrowser'" (auth.ts/forgot-password.tsx).
# Per project memory (device-uat-runas-pattern): remap so device:8081 -> host:8082 (orbit).
~/.local/bin/adb -s 1A071FDEE002BU reverse tcp:8081 tcp:8082
~/.local/bin/adb -s 1A071FDEE002BU shell am force-stop com.bwales.orbit
~/.local/bin/adb -s 1A071FDEE002BU shell monkey -p com.bwales.orbit -c android.intent.category.LAUNCHER 1
  -> orbit loaded correctly (fresh bundle incl. instrumentation)

# navigate Settings (gear) -> Check linked contacts, capture on-screen message
~/.local/bin/adb -s 1A071FDEE002BU shell input touchscreen tap 1307 165      # Settings gear
~/.local/bin/adb -s 1A071FDEE002BU shell input touchscreen tap 720 887        # Check linked contacts
~/.local/bin/adb -s 1A071FDEE002BU shell uiautomator dump /sdcard/ui.xml ; pull
  -> on-screen text (the crash, verbatim):
     [BUGB] cid=3 links=1 photo=avatars/contact-3.jpg name=TypeError
     MSG=Cannot read property 'subtle' of undefined
     PROBE=subtle=undefined digest=undefined
     FRAME=TypeError: Cannot read property 'subtle' of undefined
        || at ?anon_2_digest (...transform.engine=hermes...:305846:39) || at next (native)
```

**Cleanup performed after diagnosis:**
- `git checkout -- src/screens/ReconcileGridScreen.tsx` — all `// BUGB-INSTRUMENT` edits reverted; `git status --short src/` is empty; no `BUGB` markers remain in `src/`.
- `adb reverse` restored to baseline: `tcp:8081 -> tcp:8081`, `tcp:8082 -> tcp:8082`.
- Background `logcat` capture stopped.

**Instrumentation used (temporary, now reverted):** an inner `try/catch` around the per-contact body of the scan loop that re-threw an `Error` carrying `contactId`, link count, photo path, the original `name`/`message`, a `typeof globalThis.crypto.subtle(.digest)` probe, and the first stack frames; plus the `useEffect` `.catch` changed to `setMessage(error.message)` so the crash rendered on screen (JS console was not reaching logcat).
