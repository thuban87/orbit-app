# Platform verification — contact create/edit forms & CRUD widgets

**Scope:** React Native / Expo SDK 57 (v57.0.0), Android-first, custom dev client already required (widget + share-intent), so config plugins and native modules are in-bounds.

**Method:** Verified against current official docs and npm (WebSearch / WebFetch), August 2026. Package versions and doc URLs cited inline. Not training data.

**Verifier stance:** facts only, no product decisions.

---

## 1. Dropdown / single-select picker

**Two viable native options in SDK 57.**

### `@react-native-picker/picker` — current **2.11.4**
- npm: https://www.npmjs.com/package/@react-native-picker/picker (latest 2.11.4)
- Expo SDK 57 entry: https://docs.expo.dev/versions/latest/sdk/picker/ ("access to the system UI for picking between several options")
- GitHub API/props: https://github.com/react-native-picker/picker
- **Android renders a genuinely native control.** The `mode` prop selects which:
  - `mode="dialog"` (**default**) — opens a modal dialog list. `prompt` prop sets the dialog title (Android, dialog mode only).
  - `mode="dropdown"` — a dropdown/spinner anchored to the picker view.
- Android-specific knobs: `dropdownIconColor`, `dropdownIconRippleColor`, `numberOfLines`, `enabled`, plus per-`Picker.Item` `contentDescription`. `onFocus`/`onBlur` and programmatic focus/blur exist (Android 1.16.0+).
- **Quirk that changes UI work:** the picker is a bare native control with no built-in label/placeholder/pressable-row chrome. To match a "tap a row → sheet opens" form pattern you build the trigger row yourself. There is no first-class "placeholder" state — the first `Picker.Item` acts as the shown value.

### `@expo/ui` Picker — current **57.0.10** (stable in SDK 56, shipped in 57)
- npm: https://www.npmjs.com/package/@expo/ui (57.0.10)
- Universal component docs: https://docs.expo.dev/versions/latest/sdk/ui/universal/
- Expo positions `@expo/ui`'s picker as **"a drop-in replacement for `@react-native-picker/picker`, powered by Jetpack Compose on Android and SwiftUI on iOS."**
- Universal layer delegates to `@expo/ui/jetpack-compose` on Android. Requires the custom dev client (already have it). API tracks SwiftUI's `Picker` + `pickerStyle`.
- Trade-off worth flagging: `@expo/ui` is newer and its universal surface is still settling release-to-release; `@react-native-picker/picker` at 2.11.4 is the mature, widely-deployed choice (420+ dependent projects).

**Decision-relevant:** either gives a real native Android picker — no need for a JS-emulated `<select>` shim (e.g. `react-native-picker-select`). Both the category picker and the social-battery 3-option dropdown map directly onto this. The category list being user-editable is just a dynamic `Picker.Item[]`; no platform constraint there.

---

## 2. Date input with an OPTIONAL year — **the year cannot be made optional in the native picker**

- Package: `@react-native-community/datetimepicker` — Expo SDK 57 recommends/bundles **9.1.0**.
  - npm: https://www.npmjs.com/package/@react-native-community/datetimepicker (latest 9.1.0)
  - Expo SDK entry: https://docs.expo.dev/versions/latest/sdk/date-time-picker/
  - GitHub README: https://github.com/react-native-datetimepicker/datetimepicker
- **Confirmed:** `mode` values are `date` / `time` (Android/iOS), plus `datetime` and `countdown` (iOS only). **There is no "month + day, no year" mode, and none of the Android `display` values (`default`, `spinner`, `calendar`) removes the year.** The Android date picker always collects a full Y-M-D date. The only year-related knob is `startOnYearSelection` (opens on the year wheel first) — it does not make the year optional.
- **Constraint, stated precisely:** a birthday where the day/month is known but the year is not **cannot** be expressed by the native picker. The picker will always force *some* year. Year-optional birthdays must be handled in app logic — e.g. a separate "year unknown" toggle (or an explicit sentinel), storing month+day independently of year, and rendering the year as absent. The picker still needs *a* year selected during entry (use current year or a fixed placeholder), which the app then discards when the toggle says "no year." No native picker anywhere on Android collects month+day alone.

---

## 3. Keyboard types for phone / email inputs — **fully supported, cross-platform**

- Docs: https://reactnative.dev/docs/textinput
- `keyboardType="phone-pad"` and `keyboardType="email-address"` are both **cross-platform** (work on Android). Confirmed against the current cross-platform list (`default`, `number-pad`, `decimal-pad`, `numeric`, `email-address`, `phone-pad`, `url`).
- **Android autofill:** use `autoComplete`, not `textContentType`. `textContentType` is **iOS-only**.
  - Phone: `autoComplete="tel"` (cross-platform); Android also has `tel-country-code`, `tel-device`, `tel-national`.
  - Email: `autoComplete="email"` (cross-platform).
- No decision-changing surprise here — this is the "confirm the obvious" item; the only actionable note is *use `autoComplete` for Android autofill, not `textContentType`.*

---

## 4. Tappable contact link / phone / email — **works, but needs an AndroidManifest `<queries>` config plugin**

- API: `expo-linking` (`Linking.openURL`, `Linking.canOpenURL`), SDK 57.
  - SDK ref: https://docs.expo.dev/versions/latest/sdk/linking/
  - Guide: https://docs.expo.dev/linking/into-other-apps/
  - Android platform docs: https://developer.android.com/training/package-visibility and https://developer.android.com/training/package-visibility/declaring
- `Linking.openURL()` handles `tel:`, `mailto:`, and `https:`.
- **Android 11+ (API 30+) package-visibility catch — decision-relevant:**
  - `Linking.canOpenURL()` for external schemes **requires declaring `<queries>` intents in AndroidManifest**, or it returns `false` even when a handler app is installed. Expo's guide states this explicitly: *"using `Linking.canOpenURL` to query other apps' linking schemes requires additional configuration."*
  - `openURL()` for the common schemes generally still works without the queries declaration — the guide ties the `<queries>` requirement specifically to the `canOpenURL` capability check, not to baseline `openURL`.
  - **Actionable:** if the form uses `canOpenURL` as a guard before showing/enabling a tappable link (the natural pattern), a config plugin adding `<queries>` is required, e.g.:
    ```ts
    config.modResults.manifest.queries = [{
      intent: [
        { action: [{ $: { 'android:name': 'android.intent.action.SENDTO' } }],
          data: [{ $: { 'android:scheme': 'mailto' } }] },
        { action: [{ $: { 'android:name': 'android.intent.action.DIAL' } }] },
      ],
    }];
    ```
    (Add an `https`/`android.intent.action.VIEW` browser query for the contact-link URL.) The custom dev client is already required, so shipping this plugin is free. Simplest robust path: skip `canOpenURL` and just `openURL()` inside a try/catch, which sidesteps the visibility gate for the happy path.

---

## 5. Form validation — **no framework-level "required"; validation is entirely app code**

- React Native `TextInput` (https://reactnative.dev/docs/textinput) has **no HTML5-`required` equivalent** and no native form/validation layer. There is no RN-native "form" element that enforces required fields, min/max, or format.
- All required-field / format / range enforcement is app-code (or a JS library like react-hook-form / zod, entirely on the JS side — no native component). Nothing to verify further; there is simply no platform primitive to lean on.

---

## 6. Text input length / multiline — **no platform limit worth designing around**

- `TextInput` `multiline={true}` for the notes field. No documented character cap; `maxLength` (a number prop) is available if a cap is ever wanted and is preferred over JS-side trimming ("use this instead of implementing the logic in JS to avoid flicker").
- **One cross-platform rendering quirk:** multiline text aligns to the **top on iOS but centers on Android** by default. Set `textAlignVertical="top"` for consistent behavior. Android uses `rows` (not iOS-New-Arch `numberOfLines`) to set initial line count.
- No storage-side limit from SQLite either (TEXT is unbounded for practical purposes). Nothing here changes a design decision.

---

## Summary of decision-changing findings

1. **Year-optional birthday is impossible in the native date picker** (`@react-native-community/datetimepicker` 9.1.0) — Android always forces a full Y-M-D. Needs an app-level "year unknown" toggle + independent month/day storage.
2. **Native Android picker is a solved problem** — `@react-native-picker/picker` 2.11.4 (mature) or `@expo/ui` 57.0.10 (Jetpack Compose, drop-in replacement). No JS `<select>` shim needed. Default Android mode is a modal dialog; `dropdown` mode available.
3. **Tappable tel/mailto/https needs a `<queries>` config plugin** if `canOpenURL` is used as a guard on Android 11+ — otherwise it reports `false`. Config plugin is cheap (dev client already required); or use `openURL` in try/catch to avoid the gate.
4. **Phone/email keyboards + autofill are fully supported** — use `autoComplete` (`tel`/`email`) for Android, not iOS-only `textContentType`.
5. **No native validation and no native required-field** — all validation is app code.
6. **Multiline notes:** set `textAlignVertical="top"` for iOS/Android parity; no length limit to design around.

---

### Sources
- @react-native-picker/picker (2.11.4): https://www.npmjs.com/package/@react-native-picker/picker · https://docs.expo.dev/versions/latest/sdk/picker/ · https://github.com/react-native-picker/picker
- @expo/ui (57.0.10): https://www.npmjs.com/package/@expo/ui · https://docs.expo.dev/versions/latest/sdk/ui/universal/
- @react-native-community/datetimepicker (9.1.0): https://www.npmjs.com/package/@react-native-community/datetimepicker · https://docs.expo.dev/versions/latest/sdk/date-time-picker/ · https://github.com/react-native-datetimepicker/datetimepicker
- expo-linking / package visibility: https://docs.expo.dev/versions/latest/sdk/linking/ · https://docs.expo.dev/linking/into-other-apps/ · https://developer.android.com/training/package-visibility · https://developer.android.com/training/package-visibility/declaring
- TextInput: https://reactnative.dev/docs/textinput
