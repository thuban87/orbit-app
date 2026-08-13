# Workpaper 04-log — Platform constraints: datetime entry, time-zone correctness, undo, SQLite write ergonomics

**Prepared:** 2026-08-12
**Scope:** The interaction log. Verifies the platform floor under the already-decided model (dossier `01-data`): interaction rows store a **local datetime**, rows are fully editable after the fact, edits recompute `contacts.last_contact` as `MAX`, and SQL uses `date('now','localtime')` semantics.
**Not re-litigated:** the local-datetime decision itself, editability, the `MAX` recompute, and the `localtime` SQL convention. Those are inputs here, not questions.

**Method.** Current official docs (`docs.expo.dev`, `developer.android.com`, `source.android.com`, `sqlite.org`), the npm registry, and **direct inspection of the published npm artifacts** downloaded into the session scratchpad:

| Package | Version inspected | Why |
|---|---|---|
| `expo` | 57.0.12 | `bundledNativeModules.json` — what `npx expo install` pins on SDK 57 |
| `expo-sqlite` | 57.0.1 | transaction APIs, vendored SQLite amalgamation, Android build flags |
| `@react-native-community/datetimepicker` | 9.1.0 | the datetime entry surface |
| `@expo/ui` | 57.0.10 | Expo's own alternative picker |

Evidence labels: **[SOURCE]** = read out of the published tarball · **[DOC]** = current official documentation · **[INFERRED]** = reasoned, not directly observed · **[UNVERIFIED]** = could not be confirmed in this session.

> Scratchpad paths below (`/tmp/claude-1000/.../scratchpad/pkgs/...`) are session-local and will not survive. The `package/...` suffix of each path is stable inside the tarball, so any claim can be re-checked with `npm pack <pkg>@<version>`.

---

## 0. Summary of findings that change or constrain a decision

| # | Finding | Effect |
|---|---|---|
| **G1** | **Android has no combined date+time picker. Anywhere.** `@react-native-community/datetimepicker` exposes only `mode: 'date' | 'time'` on Android; `'datetime'` is iOS-only. `@expo/ui` says so in its own source comment and **silently degrades `mode:'datetime'` to a date-only picker on Android**. | Correcting date *and* time is unavoidably **two sequential dialogs**. Any spec that says "open a datetime picker" is unimplementable. The silent degrade is a data-loss trap: the time half is never collected and no error is raised. |
| **G2** | Picker colours on `@react-native-community/datetimepicker` are **build-time only** — set through an Expo config plugin that writes `colors.xml`/`styles.xml`, explicitly "color properties that cannot be set at runtime." `@expo/ui` exposes ~38 **runtime** Material 3 colour props. | Directly collides with the CLAUDE.md rule that *"changing the active theme profile must restyle the entire app."* With the community picker, the two dialogs in the app's most-used flow will not follow a runtime theme switch. `@expo/ui` is the only option that can. **Owner decision — visual/taste.** |
| **G3** | Both pickers are **in Expo Go** on SDK 57 (`@react-native-community/datetimepicker` pinned to exactly `9.1.0`; `@expo/ui` to `~57.0.10`). But the community picker's Material 3 variant (`design:'material'`, which is what unlocks keyboard time entry via `initialInputMode`) requires editing `styles.xml` to `Theme.Material3.DayNight.NoActionBar` — **impossible in Expo Go.** | The "type the time in" affordance is gated on a dev build for the community picker. `@expo/ui`'s time picker has **no keyboard-entry variant at all** (Material 3 `TimePicker` clock dial only). Neither library gives keyboard time entry in Expo Go. |
| **G4** | `withTransactionAsync` **still** issues an unconditional `ROLLBACK` in its `catch` and the original error is thrown *after* it — so a throwing `ROLLBACK` masks the real error. **This also applies to `withExclusiveTransactionAsync`**, which the prior workpaper did not say. | Confirms and **extends** finding F5 of `01-data/platform-expo-sqlite.md`. Neither API is safe to rely on for error reporting; the log's write path must not depend on the thrown error being the real one. |
| **G5** | `PRAGMA foreign_keys` is still **OFF inside `withExclusiveTransactionAsync`**, unconditionally, and cannot be turned on. Confirmed structurally: `Transaction.createAsync` opens a fresh connection, then `BEGIN` is issued before your callback runs, and the pragma "is a no-op within a transaction." | Confirms finding F2. Unchanged in 57.0.1. |
| **G6** | `expo-sqlite` **never sets `journal_mode`**. Zero occurrences in the entire native layer. Expo's own docs say *"Enable WAL journal mode when you create a new database to improve performance in general."* | Default is the rollback journal, which serializes readers against every write. The log is the highest-frequency writer in the app. WAL is persistent once set. This is a one-line, one-time setup decision that nothing else will make for you. |
| **G7** | **On Android 14+, a backgrounded app process is frozen 10 seconds after entering the cached state; all threads are suspended and get zero CPU.** | A JS `setTimeout`-based "undo window" **does not reliably run**. Any design where the delete is *deferred* until the timer fires is broken by backgrounding, not just by process death. The delete must commit immediately, with the snapshot written in the same transaction; the snackbar is then purely cosmetic. |
| **G8** | Android's own guidance: a snackbar is *"ideal for brief messages that the user doesn't need to act on"*, and React Native core ships **no** snackbar (only `ToastAndroid`, which has no action button). | Undo-via-snackbar is a courtesy affordance, not a recovery mechanism, and it costs a dependency. The recovery mechanism is the snapshot table (`HANDOFF.md` §14.6 pattern). |
| **G9** | **SQLite has no IANA time-zone support.** The only zone modifiers compiled into the vendored amalgamation are `localtime`, `utc`, and `auto`. `localtime` resolves through the C library, which on Android reads the device tz database. | You cannot convert a stored instant to a *named* zone in SQL. If the schema ever stores UTC, all zone-aware rendering must happen in TypeScript — where Hermes' `Intl` timeZone support is itself shaky. This constrains option (b) in §2. |
| **G10** | Storing local wall-clock text vs. storing UTC have **opposite** failure modes, and the app's own decided workflow ("correct the date and time later") makes the UTC failure mode user-visible as apparent data corruption. | Recommendation given in §2.4, but **this is an open question for the owner**, not a decision made here. |

---

## 1. Datetime entry on Android, Expo SDK 57

### 1.1 Versions — what `npx expo install` actually gives you

From `expo@57.0.12`'s `package/bundledNativeModules.json` **[SOURCE]**:

```
"@react-native-community/datetimepicker": "9.1.0"     ← exact pin, no range
"@expo/ui": "~57.0.10"
"expo-sqlite": "~57.0.1"
```

`@react-native-community/datetimepicker` npm `latest` is **9.1.0**, published 2026-06-16 **[SOURCE]** — so the Expo pin *is* the current release. Its `peerDependencies` declare `expo: ">=52.0.0"` (optional) and it was developed against `react-native@0.83.3` / `expo@^55` (`package/package.json` devDependencies) **[SOURCE]**; Expo SDK 57 is React Native 0.86. Expo's compatibility list, not the library's devDeps, is authoritative here.

The Expo docs page for the component reports **"Included in Expo Go"** for v57 **[DOC]** — https://docs.expo.dev/versions/latest/sdk/date-time-picker/. The library's own README says the same, with a caveat worth quoting **[SOURCE]** (`package/README.md:125`):

> This module is part of Expo Go — see docs. However, Expo Go may not contain the latest version of the module and therefore, the newest features and bugfixes may not be available.

`@expo/ui@57.0.10` is likewise listed as included in Expo Go **[DOC]** — https://docs.expo.dev/versions/latest/sdk/ui/. Neither package is marked experimental in its own README or CHANGELOG **[SOURCE]**.

### 1.2 There is no combined date+time picker on Android — VERIFIED

**`@react-native-community/datetimepicker`.** The mode enum is defined once, and Android's copy has exactly two members **[SOURCE]** (`package/src/constants.js`):

```js
const COMMON_MODES = Object.freeze({ date: 'date', time: 'time' });
export const ANDROID_MODE = COMMON_MODES;
export const IOS_MODE = Object.freeze({ ...COMMON_MODES, datetime: 'datetime', countdown: 'countdown' });
```

The README's `mode` table agrees **[SOURCE]** (`package/README.md`, `#mode-optional`): `"datetime"` and `"countdown"` are annotated **`(iOS only)`**. The README also states plainly why this cannot be fixed at the library level **[SOURCE]** (`package/README.md:282`):

> this library currently exposes functionality from `UIDatePicker` on iOS and **DatePickerDialog + TimePickerDialog** on Android … These native classes offer only limited configuration … if your requirement is not supported by the backing native views, this library will *not* be able to implement your requirement.

**`@expo/ui`.** Same constraint, stated in Expo's own source **[SOURCE]** (`package/src/community/datetime-picker/DateTimePicker.android.tsx`, `modeToDisplayedComponents`):

```tsx
case 'datetime':
  // Android has no inline datetime picker — fall back to date only.
  return 'date';
```

and again in the low-level API's doc comment **[SOURCE]** (`package/src/jetpack-compose/DatePicker/index.tsx`, `displayedComponents`):

> `dateAndTime` is only available on iOS and will result in a date picker on Android.

**This is the sharp edge:** on Android, passing `mode: 'datetime'` to `@expo/ui` does not throw, does not warn, and does not degrade visibly — it opens a date picker and the time half is silently never collected. Given that the whole point of the log's edit flow is correcting the *time*, a spec written as "open a datetime picker" would ship a feature that quietly drops half its input.

**Consequence:** two sequential dialogs — `mode:'date'`, then on confirm `mode:'time'` — is the only implementation. Sequencing them is the app's job; neither library chains them.

One helpful detail for that chain **[SOURCE]** (`package/android/src/main/java/com/reactcommunity/rndatetimepicker/RNMaterialDatePicker.kt`, `createNewCalendar`): the Material date picker explicitly carries the hour and minute across from the value you passed in —

```kotlin
newCalendar[Calendar.HOUR_OF_DAY] = initialDate.hour()
newCalendar[Calendar.MINUTE]      = initialDate.minute()
newCalendar[Calendar.SECOND]      = 0
newCalendar[Calendar.MILLISECOND] = 0
```

— so a date-then-time chain does not lose the time when the user cancels the second dialog. Note it also **zeroes seconds and milliseconds**, which is convenient given the log stores minute precision.

### 1.3 `display` on modern Android — most values are ignored

**[SOURCE]** (`package/src/constants.js`), verbatim comment:

```js
export const ANDROID_DISPLAY = Object.freeze({
  default: 'default',
  spinner: 'spinner',
  // NOTE: the following are exposed, but the native module instead uses "default"
  clock: 'clock',
  calendar: 'calendar',
});
```

And the coercion is unconditional **[SOURCE]** (`package/src/DateTimePickerAndroid.android.js:81-84`):

```js
const displayOverride =
  display === ANDROID_DISPLAY.spinner ? ANDROID_DISPLAY.spinner : ANDROID_DISPLAY.default;
```

So on Android there are effectively **two** displays: `default` (the platform's calendar / clock-dial dialogs) and `spinner` (wheels). `clock` and `calendar` are accepted and ignored. `validateAndroidProps` will still `invariant`-throw on the nonsensical combinations (`display:'calendar'` + `mode:'time'`, `display:'clock'` + `mode:'date'`) **[SOURCE]** (`package/src/androidUtils.js`).

`@expo/ui` maps its `display` differently and documents the difference **[SOURCE]** (`package/src/community/datetime-picker/types.tsx`):

> Android supports `'default' | 'spinner'` — **`'spinner'` shows a text input rather than a scroll wheel (Material 3 does not have a wheel-style picker).**

That is a genuine behavioural divergence between the two libraries under the same prop name.

### 1.4 Material 3 variant, keyboard entry, and what it costs

The community picker gained a `design` prop **[SOURCE]** (`package/README.md:323-333`): `"default"` (stock `DatePickerDialog`/`TimePickerDialog`) or `"material"` (Material 3 `MaterialDatePicker`/`MaterialTimePicker`). Four props — `initialInputMode`, `title`, `fullscreen`, `startOnYearSelection` — are gated on it; using them with `design:'default'` logs a warning and does nothing **[SOURCE]** (`package/src/androidUtils.js`, `validateMaterial3PropsNotUsed`).

`initialInputMode: 'keyboard'` is the one that matters for this domain — it opens the time picker in **text entry** rather than the clock dial **[SOURCE]** (`package/src/materialtimepicker.android.js` doc comment; `RNMaterialTimePicker.kt`). For "correct the timestamp to 19:45 two days later," typing is materially faster than dragging a dial twice.

**But** — **[SOURCE]** (`package/README.md:274`):

> If you'd like to use the Material pickers, your app theme will need to inherit from `Theme.Material3.DayNight.NoActionBar` in `styles.xml`.

`styles.xml` is a native Android resource. Changing it means `expo prebuild` + a development build. **In Expo Go, `design:'material'` is unavailable**, and with it `initialInputMode`. (The stock `TimePickerDialog` still has Android's own clock/keyboard toggle button, so keyboard entry is *reachable* by an extra tap — it just cannot be made the default.)

`@expo/ui` does not solve this either. Its Android time picker is hard-wired to the Material 3 clock dial with no text-input variant **[SOURCE]** (`package/android/src/main/java/expo/modules/ui/DatePickerView.kt:528-533`):

```kotlin
TimePicker(
  modifier = modifier,
  state = state,
  layoutType = TimePickerLayoutType.Vertical,
  colors = buildTimePickerColors(props.elementColors, props.color.composeOrNull)
)
```

`variant: 'input'` (→ `DisplayMode.Input`) is honoured only by the **date** picker (`DatePickerView.kt:61-64, 326-334`) **[SOURCE]**. And `TimePickerDialogProps` has **no `variant` field at all** **[SOURCE]** (`package/src/jetpack-compose/DatePicker/index.tsx`).

**Net:** neither library offers keyboard-first time entry in Expo Go. The community picker offers it behind a dev build; `@expo/ui` does not offer it at all.

### 1.5 Theming — the collision with the project's colour rule

CLAUDE.md, Conventions: *"All colours resolve through theme tokens … Changing the active theme profile must restyle the entire app."*

**Community picker.** Styling is done by an Expo config plugin (`package/app.plugin.js` → `package/plugin/build/withDateTimePickerStyles.js`) which writes entries into `colors.xml`, `colors-night.xml` and `styles.xml` at prebuild time **[SOURCE]**. The README is explicit **[SOURCE]** (`package/README.md:276`):

> Styling of the dialogs on Android can be easily customized by using the provided config plugin, provided that you use an Expo development build. The plugin allows you to configure **color properties that cannot be set at runtime** and requires building a new app binary to take effect.

Two colour sets only (light + `values-night`), baked into the APK. A runtime theme-profile switch cannot reach them.

**`@expo/ui`.** Exposes `elementColors`, a record of **24 date-picker colours and 14 time-picker colours**, all settable per render as ordinary `ColorValue` props **[SOURCE]** (`package/src/jetpack-compose/DatePicker/index.tsx`, `DatePickerElementColors` / `TimePickerElementColors`; mirrored in `DatePickerView.kt:70-147`). Plus a single `color` tint that covers "selected day, title, headline, today border … selector, selected time segment, clock dial" when `elementColors` is omitted **[SOURCE]** (same file, `color` doc comment).

`@expo/ui` is therefore the **only** option that satisfies the project's stated colour rule for these dialogs. That is a real reason to prefer it, weighed against §1.4 (no keyboard time entry) and §1.2 (the silent `datetime` degrade, which the app must route around either way).

### 1.6 Imperative vs component API — the library's own guidance

**[SOURCE]** (`package/README.md`, "Android imperative api"):

> The reason we recommend the imperative API is: on Android, the date/time picker opens in a dialog, similar to `ReactNative.alert()`. The imperative api models this behavior better than the declarative component api. While the component approach is perfectly functional, **based on the issue tracker history, it appears to be more prone to introducing bugs.**

The concrete pitfall is in the component's own source **[SOURCE]** (`package/src/datetimepicker.android.js`, comment on the effect's dep array):

> the android dialog, when presented, will actually **ignore updates to all props other than `value`**

The component re-fires `DateTimePickerAndroid.open()` only on `[onChange, onValueChange, onDismiss, onNeutralButtonPress, valueTimestamp, mode]`; everything else is captured at open time. For a two-dialog chain — where `mode` flips from `date` to `time` mid-flow — the imperative API is the less surprising choice.

**Also note the API deprecation** (both libraries, in this release): `onChange` is deprecated in favour of `onValueChange` + `onDismiss` + `onNeutralButtonPress`, and warns once in `__DEV__` **[SOURCE]** (`package/src/utils.js`, `warnIfOnChangeIsUsed`; `@expo/ui` `types.tsx` marks `onChange` `@deprecated`). And `timeZoneOffsetInMinutes` is deprecated in favour of `timeZoneName` **[SOURCE]** (`package/src/utils.js`, `sharedPropsValidation`). New code should use the new callbacks from day one.

### 1.7 Android 14/15/16 behaviour changes

Nothing picker-specific was found. The Android 16 (API 36) behaviour-changes pages call out **predictive back enabled by default** (`onBackPressed` no longer called, `KEYCODE_BACK` no longer dispatched) and **edge-to-edge enforcement** **[DOC]** — https://developer.android.com/about/versions/16/behavior-changes-16. Neither names `DatePickerDialog` or `TimePickerDialog`.

Both libraries present their pickers as `DialogFragment`s and report dismissal through `DialogInterface.OnDismissListener` (`RNMaterialDatePicker.kt`, `Listeners.onDismiss`) **[SOURCE]**, which is the framework path predictive back drives — so back-dismissal should continue to fire `onDismiss`. **[INFERRED]** — not verified on a device in this session.

The only Android version gates in the community picker's Android source target **KitKat, Nougat, Lollipop, O and M** — i.e. legacy floors, nothing modern **[SOURCE]** (`grep -rn "Build.VERSION" package/android/src/main/java/...`, 7 hits, highest constant `VERSION_CODES.O`).

The `minSdkVersion`/`compileSdkVersion`/`targetSdkVersion` are all inherited from the host project's `rootProject.ext` **[SOURCE]** (`package/android/build.gradle`), so Expo's SDK 57 template decides them, not the library.

**[UNVERIFIED]** Nothing here was exercised on the owner's Pixel 6 Pro. §1.2 through §1.6 are all artifact- or doc-verified, not device-verified.

---

## 2. Time zone and DST correctness for stored local datetimes

### 2.1 What `localtime` actually resolves through — VERIFIED

The `localtime` modifier is compiled in (`SQLITE_OMIT_LOCALTIME` is not defined) and reaches the C library through one function **[SOURCE]** (`expo-sqlite@57.0.1`, `package/vendor/sqlite3/sqlite3.c:25267-25310`, `osLocaltime`):

```c
#if HAVE_LOCALTIME_R
  rc = localtime_r(t, pTm)==0;
#else
  rc = localtime_s(pTm, t);
#endif
```

with a mutex-guarded `localtime()` fallback when neither is declared.

**expo-sqlite's Android build does not define `HAVE_LOCALTIME_R`.** The full flag set is **[SOURCE]** (`package/android/build.gradle:27-34`):

```
-DSQLITE_ENABLE_BYTECODE_VTAB=1 -DSQLITE_TEMP_STORE=2
-DSQLITE_ENABLE_SESSION=1 -DSQLITE_ENABLE_PREUPDATE_HOOK=1
-DSQLITE_ENABLE_MATH_FUNCTIONS=1
[+ FTS3/4/5 when enabled, + SQLCipher flags when enabled]
```

and `android/CMakeLists.txt` passes exactly that through `SQLITE_BUILDFLAGS` with nothing added **[SOURCE]**. So on Android the **non-reentrant `localtime()` + static mutex** branch is compiled. Functionally identical result; it serialises concurrent `localtime` calls on a global mutex. Irrelevant at this app's write volume.

Either way, the answer to the question asked: **yes, `localtime` depends entirely on the device's tz database and current zone setting**, because it is `libc`'s job, not SQLite's. On Android that is bionic reading the system tzdata. **[SOURCE]** for the call path; **[INFERRED]** for bionic's behaviour — **[UNVERIFIED]** on-device.

Two consequences worth writing down:

1. **A mid-session time-zone change may make SQL and JS disagree.** SQLite's `date('now','localtime')` re-enters `localtime()` on every call, in native code. Hermes caches the process's zone. `@callstack/timezone-hermes-fix` exists precisely because "the device timezone changes while the app is running" and "date/time calculations don't reflect the current timezone" in Hermes, and it works by resetting the native timezone cache — https://github.com/callstack/timezone-hermes-fix **[DOC]**. It requires a native module (dev build). Whether RN 0.86 / current Hermes still needs it is **[UNVERIFIED]** — the README's support matrix stops at "0.4.0+: React Native 0.82.x and above" and makes no statement about an upstream fix. **If it still holds, then `formatLocalDate()` in JS and `date('now','localtime')` in SQL can return different dates in the same session on a device that changed zone.** That is exactly the class of off-by-one-day bug CLAUDE.md already warns about.

2. **SQLite has no IANA time zones.** The complete modifier list in the vendored amalgamation is `ceiling`, `floor`, `julianday`, `unixepoch`, `subsec`/`subsecond`, `auto`, **`localtime`**, **`utc`**, plus `NNN days|hours|minutes|seconds|months|years` and `start of …`/`weekday N` **[SOURCE]** (`sqlite3.c:25460-25720`). There is no `datetime(x, 'America/New_York')`. Any named-zone conversion must happen in TypeScript, where Hermes' `Intl` timeZone support is itself unreliable (see above). **This is a hard constraint on any design that stores UTC and renders in a chosen zone.**

3. **Minor, but real for custom date fields:** for instants outside 1970-01-01 … 2038-01-18, SQLite maps the year into an equivalent in-range year, computes, and maps back **[SOURCE]** (`sqlite3.c:25330-25344`, `toLocaltime`, citing `EVIDENCE-OF: R-55269-29598`). Irrelevant for interaction rows; relevant if a custom field ever holds a pre-1970 date (a birthday) and something applies `'localtime'` to it.

### 2.2 Failure mode (a): storing local wall-clock text

Schema: `occurred_at TEXT` holding `'YYYY-MM-DD HH:MM'` in the device's zone at entry time, with no offset recorded.

- **The displayed value never changes.** What the user set is what they see, on any device, in any zone, forever. For a log the user deliberately hand-corrects, this is the property that matches their mental model.
- **DST is a non-event.** The fall-back hour repeats `01:30` and the spring-forward hour skips `02:30`, but text storage never has to resolve either — a nonexistent or doubled wall-clock time round-trips verbatim. There is no instant to disambiguate, so nothing can be wrong.
- **Rows are ordered by wall clock, not by instant.** After travel, a touchpoint logged at 09:00 in Auckland (UTC+12) and one logged at 20:00 the previous calendar day in Los Angeles (UTC-7) sort in the wrong real-world order. `contacts.last_contact = MAX(occurred_at)` inherits this.
- **Elapsed-time math drifts by the offset delta.** `julianday(date('now','localtime')) - julianday(substr(occurred_at,1,10))` is off by at most one day per timezone hop. For "days since last contact" driving orbit decay, a one-day error is cosmetic.
- **Rows are not comparable to anything external.** No calendar import, no cross-device merge, no correct "3 hours ago."

### 2.3 Failure mode (b): storing UTC (epoch or ISO), converting on read

- **Ordering, elapsed time, and `MAX` are exactly right.** Always, everywhere.
- **The displayed value moves when the user does.** A touchpoint the user carefully corrected to *"Aug 3, 19:45"* in London renders as *"Aug 3, 14:45"* after a flight to New York — and *"Aug 3, 06:45"* becomes *"Aug 2, 22:45"*, a **different calendar day**. Nothing was corrupted; it looks exactly like corruption.
- **This lands on the decided workflow, not on an edge case.** Dossier 01-data's stated primary flow is: auto-stamp now, then hand-correct the date and time later. Hand-correction is an assertion about wall-clock time. Storing it as an instant and re-deriving the wall clock later is the one representation guaranteed to un-assert it.
- **It propagates to `contacts.last_contact`.** If that column is a date derived from the interaction, a zone change can shift a contact's status by a day for reasons the user cannot see.
- **Rendering is constrained by §2.1.2.** SQL can only render in `utc` or `localtime`. Rendering in the zone the row was *captured* in requires storing that zone and formatting in TypeScript — where Hermes may not support the `timeZone` option reliably.
- **DST must be resolved at write time.** A user hand-entering `02:30` on a spring-forward night has entered a time that does not exist; converting to an instant forces a silent choice.

### 2.4 Recommendation — and the question that belongs to the owner

**Recommendation (not a decision):** keep the wall-clock text as the authoritative, user-facing value — it is what the decided workflow actually manipulates — and additionally record the UTC offset captured at entry time (`tz_offset_minutes INTEGER`, or an IANA name if one is available). Wall clock stays exact for display; the offset makes the instant recoverable for correct global ordering when it is ever needed.

**Named tradeoff:** a second column that every writer of the table must populate, and which is *wrong by construction* for hand-corrected rows — the user edits the wall clock days later, in a possibly different zone, and the offset that was captured at entry time no longer describes the moment being described. Re-deriving it on edit means asking "what zone were you in on Aug 3?", which no UI should ask. So the offset is an approximation, not a fact, and any code that treats it as exact will be wrong.

**The question for the owner is:** does the interaction log need to be correct *as a sequence of instants*, or only correct *as a record of what the user wrote down*? If the answer is the latter — which the decided workflow suggests — then wall-clock text alone is sufficient and the offset column is unnecessary complexity. **Do not resolve this in a plan. It is a data-model commitment with no migration back.**

---

## 3. Undo and recovery for a deleted interaction row

### 3.1 The platform-level finding that changes the design — VERIFIED

> **"App processes in the cached state are frozen 10 seconds after entering the cached state"** (Android 14, API 34 and higher).
> **"When an app process is frozen, all of its threads are suspended and can't perform CPU work until unfrozen."**
> **"The system immediately unfreezes a frozen app process during a lifecycle event … receiving an intent, starting a job service, or the user resuming an activity."**

**[DOC]** — https://source.android.com/docs/core/perf/cached-apps-freezer

This settles the question that was asked. A JS `setTimeout` undo window **is not a timer you can rely on**. The failure is not the exotic one (process killed) — it is the ordinary one: the user backgrounds the app, and ten seconds later the JS thread is frozen. The timer does not fire late; it does not fire at all until something unfreezes the process, which may be minutes or hours later, or never before the process is reclaimed.

**Therefore: the "defer the delete until the undo window expires" pattern is broken on Android 14+.** If the row is only tombstoned in memory and the commit is scheduled on a timer, backgrounding during the window leaves the database in a state neither the user nor the app agreed to, with no code running to resolve it.

**The pattern that works** is the one the project already committed to in `HANDOFF.md` §14.6: **delete immediately, snapshot to `field_history` (or an interaction-scoped equivalent) inside the same transaction.** Undo becomes a *restore from snapshot* — an ordinary write against durable state, correct whether it happens two seconds later or two days later. Freezing then costs nothing: the snackbar disappears, and the row is still recoverable through whatever non-transient surface exposes the snapshot. This is enforcement of an existing decision, not a new one.

### 3.2 The transient affordance itself

**React Native core ships no snackbar.** It ships `ToastAndroid`, which has no action button, so it cannot carry an "UNDO" tap. A snackbar with an action requires a dependency — `react-native-paper@5.15.3` (`Snackbar` is pure JS, Expo Go compatible) or a dedicated wrapper. **[SOURCE]** for the version; **[INFERRED]** for Paper's Snackbar being JS-only.

Android's own guidance argues against leaning on it **[DOC]** — https://developer.android.com/develop/ui/views/notifications/snackbar/showing:

> Unlike Notifications, the message automatically goes away after a short period. **A `Snackbar` is ideal for brief messages that the user doesn't need to act on.**

Duration options at the platform level are `LENGTH_SHORT` and `LENGTH_LONG` (`LENGTH_INDEFINITE` is not offered on that page) **[DOC]**.

**Net:** an undo snackbar is worth having as an ergonomic nicety. It is not a recovery mechanism, it costs a dependency, and it must never be the only path back to a deleted row. Nothing here changes what the log's delete path must do — it changes what the snackbar is *allowed to be responsible for*.

---

## 4. `expo-sqlite` write ergonomics — re-verification against 57.0.1

Both prior findings **still hold**, and one of them is **broader than previously reported**.

### 4.1 `withTransactionAsync` masks errors — CONFIRMED, and it is not the only one

**[SOURCE]** `expo-sqlite@57.0.1`, `package/src/SQLiteDatabase.ts:140-149`, verbatim:

```ts
public async withTransactionAsync(task: () => Promise<void>): Promise<void> {
  try {
    await this.execAsync('BEGIN');
    await task();
    await this.execAsync('COMMIT');
  } catch (e) {
    await this.execAsync('ROLLBACK');
    throw e;
  }
}
```

`await this.execAsync('ROLLBACK')` is the **first** statement in the `catch`. If it throws — `cannot rollback - no transaction is active`, which happens when `BEGIN` never succeeded, or when SQLite already auto-rolled-back (`SQLITE_FULL`, `SQLITE_IOERR`, `SQLITE_BUSY`, `SQLITE_NOMEM`) — then `throw e` is **never reached** and the rollback error propagates in place of the real one. Confirmed.

**New, and not in the prior workpaper: `withExclusiveTransactionAsync` has the same defect.** **[SOURCE]** (`package/src/SQLiteDatabase.ts:175-196`):

```ts
const transaction = await Transaction.createAsync(this);
let error;
try {
  await transaction.execAsync('BEGIN');
  await task(transaction);
  await transaction.execAsync('COMMIT');
} catch (e) {
  await transaction.execAsync('ROLLBACK');   // ← throws before `error = e`
  error = e;
} finally {
  await transaction.closeAsync();
}
if (error) { throw error; }
```

The `let error` / `finally` structure looks like it was written to preserve the original error — and it does, *provided the `ROLLBACK` succeeds*. If it throws, `error = e` is skipped and the rollback error escapes the `catch` unchanged. So **the prior workpaper's F5 recommendation ("use `withExclusiveTransactionAsync`, and never let the original error be swallowed") is correct in its first half but the second half needs an explicit mechanism** — the exclusive variant does not provide it for free. Capture the real error inside your own `task` callback, or wrap the call, if the log's write path is ever expected to report *why* a write failed.

### 4.2 Foreign keys OFF inside exclusive transactions — CONFIRMED

Structurally unchanged. **[SOURCE]** (`package/src/SQLiteDatabase.ts:787-797`):

```ts
class Transaction extends SQLiteDatabase {
  public static async createAsync(db: SQLiteDatabase): Promise<Transaction> {
    const options = { ...db.options, useNewConnection: true };
    const nativeDatabase = new ExpoSQLite.NativeDatabase(db.databasePath, flattenOpenOptions(options));
    await nativeDatabase.initAsync();
    return new Transaction(db.databasePath, options, nativeDatabase);
  }
}
```

A brand-new connection, then `BEGIN` (line 184) before your callback runs (line 185). `SQLiteOpenOptions` has exactly four public fields — `enableChangeListener`, `useNewConnection`, `finalizeUnusedStatementsBeforeClosing`, `libSQLOptions` **[SOURCE]** (`package/src/NativeDatabase.ts:42-78`) — **no pragma hook**. And `PRAGMA foreign_keys` **[DOC]** (https://www.sqlite.org/pragma.html#pragma_foreign_keys):

> "As of SQLite version 3.6.19, the default setting for foreign key enforcement is OFF."
> "This pragma is a **no-op within a transaction**; foreign key constraint enforcement may only be enabled or disabled when there is no pending BEGIN or SAVEPOINT."

`expo-sqlite` never issues it: grep for `foreign_keys` across the entire package finds **zero** hits in `src/`, `android/`, or `ios/` — the only match is a `PRAGMA foreign_keys=OFF;` string inside the bundled web-only SQL-dump helper **[SOURCE]**.

**So: `ON DELETE CASCADE` is inert inside every exclusive transaction, unconditionally.** For the log this means deleting a contact does not cascade to its interactions unless the delete is written explicitly. As the prior workpaper noted, this *enforces* the §14.5 decision to write both statements; it does not reverse anything.

### 4.3 `journal_mode` is never set — NEW

`grep -rn "journal_mode\|WAL" package/{src,android,ios}` finds **nothing** **[SOURCE]** (the only `WAL` hits are constant declarations in the bundled `web/wa-sqlite` type definitions, which do not run on Android). The database therefore opens in SQLite's default rollback-journal mode.

Expo's own documentation recommends otherwise **[DOC]** — https://docs.expo.dev/versions/latest/sdk/sqlite/:

> Enable WAL journal mode when you create a new database to improve performance in general.

For the log specifically: the interaction insert + `last_contact` recompute is the app's highest-frequency write, and it will frequently run while the dashboard is reading. Under the rollback journal a writer blocks readers for the duration of the transaction. WAL lets them proceed concurrently. WAL is **persistent** — set once on the database file and it survives close/reopen — and, like `foreign_keys`, it **cannot be set inside a transaction**, so it belongs in the same `onInit` path as the migration runner, before anything else.

### 4.4 Other confirmations relevant to the log's write path

- **`runAsync` returns `{ lastInsertRowId, changes }`** (`SQLiteRunResult`) **[SOURCE]** (`package/src/SQLiteDatabase.ts:352-358`, `package/src/SQLiteStatement.ts:245`). The new row's id is available without a follow-up `SELECT last_insert_rowid()`, and `changes` gives a free assertion that an edit actually hit a row.
- **`execAsync` takes no parameters and runs every statement in the string**, with the escaping warning in its own doc comment **[SOURCE]** (`package/src/SQLiteDatabase.ts:51-57`). Use `runAsync` for every log write; reserve `execAsync` for DDL.
- **The migration example in Expo's docs is still not transaction-wrapped**, and still writes `PRAGMA user_version` outside any transaction **[DOC]** — https://docs.expo.dev/versions/latest/sdk/sqlite/. Confirms finding F4 of the prior workpaper; unchanged.
- **`withTransactionAsync` runs on the shared connection and can interleave with other async queries** — stated in its own doc comment with a worked counter-example **[SOURCE]** (`package/src/SQLiteDatabase.ts:116-136`), and in the docs: *"Only queries that run within the scope function passed to `withExclusiveTransactionAsync()` will run within the actual SQL transaction"* **[DOC]**. The insert-plus-recompute pair must be atomic, so it belongs in `withExclusiveTransactionAsync` — accepting §4.1's error-masking caveat and §4.2's foreign-keys caveat.
- **`expo-sqlite@57.0.1`'s CHANGELOG records no user-facing changes** in either 57.0.0 or 57.0.1 **[SOURCE]**, consistent with the prior workpaper's reading.

---

## 5. Open questions for the owner

1. **§2.4 — wall clock vs. instant.** Does the interaction log need to be correct as a sequence of instants, or only as a record of what the user wrote down? A data-model commitment with no cheap migration back. Not decided here.
2. **§1.5 / G2 — picker library.** `@expo/ui` is the only option whose colours can follow a runtime theme switch, but it has no keyboard time entry and silently degrades `mode:'datetime'`. `@react-native-community/datetimepicker` has keyboard time entry (dev build only) but build-time-only colours. Visual/taste and priorities — the owner's bucket.
3. **§1.4 / G3 — Expo Go vs. development build.** Material 3 pickers, config-plugin theming, and the Hermes timezone-cache fix all require a dev build. Whether the log's entry flow is designed against Expo Go's ceiling or a dev client's is a scoping call.

---

## Changelog

- **2026-08-12** — Created. Verified against `expo@57.0.12`, `expo-sqlite@57.0.1`, `@react-native-community/datetimepicker@9.1.0`, `@expo/ui@57.0.10` published artifacts, plus current Expo / Android / SQLite documentation. Re-verified findings F2, F4 and F5 of `01-data/platform-expo-sqlite.md`; extended F5 to cover `withExclusiveTransactionAsync`.
