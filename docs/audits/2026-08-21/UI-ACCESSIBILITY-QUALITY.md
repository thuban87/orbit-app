# Orbit UI, Accessibility, Product Quality, and Test Audit

**Audit date:** 2026-08-21  
**Code snapshot:** working tree at `a4da2bd` (implementation reviewed as present on disk)  
**Platform emphasis:** Android-first Expo / React Native mobile app and Android home-screen widget  
**Verdict:** **Needs remediation before accessibility sign-off; functionally promising but not production-gated.**

## Executive verdict

Orbit has unusually strong foundations for a young mobile codebase: navigation is typed, all registered routes are reachable, colors are consistently tokenized, destructive contact deletion is deliberately two-stage, the Skia animation loop is suspended off-focus, database-heavy behavior has broad pure-logic coverage, and the current unit suite and TypeScript check pass.

The app is not yet accessible or resilient enough for a production-quality claim. Three complete workflows are blocked or materially degraded for assistive-technology users: favourites can only be reordered by dragging, the Orrery exposes no accessible contacts or actions, and dashboard contact cards announce only the contact name while suppressing the status/favourite/category/fuel information that gives the dashboard meaning. Custom-drawn screens also have no reduced-motion branch. Separately, every screen owns custom chrome but none consumes the safe-area insets supplied at the app root; this is a high-risk Android edge-to-edge defect.

Product-quality concerns cluster around friction and state integrity. The share-sheet inline-create panel is visually overlaid without becoming modal, leaving the contact grid actionable behind it and giving Back the wrong scope. Custom date and number fields accept raw values even though the settled product contract calls for a date picker and numeric-only acceptance. The contact profile mounts a complete, unbounded history inside a `ScrollView`, creating an accumulating performance problem on the app's most important long-lived surface.

Automated data and pure-logic coverage is broad, but rendered UI coverage is effectively zero. The 83-file / 1,009-test Vitest suite passes and `tsc` passes, but the test environment explicitly prohibits rendering. There is no component, navigation, accessibility, screenshot, device, or E2E harness. The repository's Biome check also fails with 28 errors, and lint/type/build checks are not exposed as package scripts.

### Finding totals

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 7 |
| Medium | 15 |
| Low | 1 |
| Info | 0 |
| **Total** | **23** |

## Scope, method, and limitations

### Reviewed

- All 13 native-stack screens, all 30 `.tsx` component files, the navigation shell and external-entry gates, theme provider/presets, and all Zustand stores.
- Dashboard, profile, create/edit, custom-field, archive, favourites, compose, external capture, photo crop, Orrery, and Android widget surfaces.
- Associated pure form/geometry/reorder/capture/compose logic and their tests.
- Loading, empty, error, success, destructive, and disabled states visible in code.
- Accessibility semantics, labels, states, focus model, touch sizes, text scaling/layout risk, color contrast, motion, modal behavior, and alternative interaction paths.
- Static and automated checks:
  - `npm test` — **PASS:** 83 files, 1,009 tests.
  - `npx tsc --noEmit` — **PASS**.
  - `npm run check:colors` — **PASS**.
  - `npx biome check .` — **FAIL:** 28 errors, 2 warnings, 3 informational diagnostics.

### Method

This was a source audit of actual code on disk, not a diff or planning-summary review. Each issue is classified as either code-proven or a code-indicated device risk. Contrast ratios were calculated from the shipped sRGB theme tokens. Route reachability was traced through the navigator, screen actions, share-intent gate, notification gate, and widget-link gate. The review used the six UI-quality pillars—visual hierarchy, spacing/layout, typography, color, states/feedback, and interaction quality—while preserving the project's settled visual/product decisions.

### Limitations

- No live/rendered APK UI inspection or device run was performed. The untracked `app-release.apk` and `app-debug.apk` artifacts dated 2026-08-17 were not used for visual or accessibility validation; no emulator, physical-device, TalkBack, switch-access, keyboard-only, screenshot-comparison, or live Android widget session was performed. Items explicitly marked **device verification** must not be represented as reproduced runtime failures.
- Native `Modal`, system photo picker, SMS app, notification permission prompt, launcher widget pinning, OS share sheet, dynamic type/font-scale behavior, cutout/gesture navigation, and hardware Back behavior require device validation.
- No visual redesign is proposed here. Settled choices—dark space palette, separate dashboard/Orrery, status styling, custom-field visibility, two-stage contact deletion, and owner-ratified widget actions—were treated as constraints.
- Performance conclusions about the unbounded React tree are code-proven structurally; frame time, memory, and threshold measurements still require a release build on representative hardware.

## Screen and route coverage map

| Surface / route | Entry and reachability | States and areas reviewed | Result |
|---|---|---|---|
| `Home` / `HomeScreen` | Initial route | Search/debounce, filters, sort, birthday banner, cards, counts, pull refresh, cause-aware empty/error, FAB, Settings and Orrery entries | Reachable; findings UX-001, UX-006, UX-013, UX-017, UX-023 |
| `Settings` | Home gear | Notification permission/settings, time controls, privacy copy, profile photo, star color, sun occupant modal, widget pin, favourites/custom-fields/archive links | Reachable; findings UX-001, UX-014, UX-019 |
| `CustomFields` | Settings | New/edit, ordering, preview, dropdown options, show-on-new, profile visibility, delete/quarantine/restore | Reachable; findings UX-001, UX-005, UX-014, UX-017 |
| `Create` | Home FAB / capture inline alternative | Fixed fields, frequency, last-spoke, phone, dynamic show-on-new fields, duplicate warning, save | Reachable; findings UX-001, UX-005, UX-009 |
| `Profile` | Dashboard/Never/Orrery/widget/notification | Header, favourite, archive, message/log, snooze, impact, fuel, timeline, refine/delete, custom values | Reachable; findings UX-001, UX-007, UX-012, UX-016, UX-022 |
| `Edit` | Profile / Compose add-number | Photo, name/category/frequency, last-spoke, phone/email/links, birthday, toggles, every dynamic field, save | Reachable; findings UX-001, UX-005, UX-009 |
| `Archived` | Settings and Home footer | Count/empty, restore, impact-aware permanent delete confirmation | Reachable; findings UX-001, UX-017, UX-018 |
| `NeverContacted` | Home counted footer | Three-way sort, card list, empty/read failure | Reachable; findings UX-001, UX-008, UX-018 |
| `ManageFavourites` | Settings / favourites filter / widget empty state | Load/error, drag reorder, persistence rollback, empty state | Reachable; findings UX-001, UX-002, UX-017 |
| `Compose` | Profile / widget / notification deep link | Loading/missing/error, ranked fuel, draft, SMS capability, copy/send | Reachable; findings UX-001, UX-009, UX-011, UX-023 |
| `Capture` | OS share intent gate | Payload validation, search, single/multi-select, inline create, commit guard, note, confirmation/auto-return | External entry is ready-gated; findings UX-001, UX-004, UX-008, UX-011, UX-023 |
| `CropPhoto` | Photo source picker | Decode/fallback, pan/pinch, crop geometry, cancel/save/failure | Internal-only and serializable; findings UX-001, UX-015 |
| `Orrery` | Home Orbit entry | Load/empty, status/relationship morph, tap profile, radial reorder, sun, pause on blur/background | Reachable; findings UX-001, UX-003, UX-008, UX-010 |
| Android widget | Launcher / pin prompt | Small and large layouts, empty deep link, Mark/Profile/Log/Message targets, breakpoint and 48dp action height | Code reviewed; live rendering/device accessibility not verified |
| Navigation and stores | Root shell, gates, persisted UI prefs/theme | Typed params, serializability, ready gates, route graph, AsyncStorage partialization | No orphan registered route found; state is narrowly persisted |

## Severity rubric

| Severity | Meaning in this audit |
|---|---|
| Critical | Credible path to irreversible loss, severe privacy/security harm, or an app-wide unusable state with no practical recovery. |
| High | A core workflow is unavailable to a user group, can misdirect a write, predictably breaks on supported platform geometry, or creates a major accumulating performance/data-quality failure. |
| Medium | Material friction, misleading state, incomplete accessibility, resilience gap, or quality-gate weakness with a workaround or narrower trigger. |
| Low | Localized polish/semantic issue with limited immediate impact. |
| Info | Verified observation that does not itself require remediation. |

## Findings

### Critical

No critical findings were identified in this audit.

### High

#### UX-001 — Custom screen chrome does not consume safe-area insets

**Evidence:** `App.tsx:254-263` supplies `SafeAreaProvider`, but `src/navigation/RootNavigator.tsx:54-76` disables the native header for every route. Screen chrome then begins at hard-coded padding—for example `src/screens/HomeScreen.tsx:582-600`—and a repository-wide search found no `SafeAreaView` or `useSafeAreaInsets` consumer in any screen. Bottom overlays are also fixed to raw offsets, such as the Home FAB at `src/screens/HomeScreen.tsx:566-575` and Capture bars at `src/screens/CaptureScreen.tsx:1056-1063` and `1086-1094`.

**Affected users/scenario:** Users on current Android edge-to-edge devices, display cutouts, gesture navigation, and unusual system-bar sizes; every route is affected.

**Impact:** Headers can occupy the status-bar/cutout area and bottom actions can collide with the gesture/navigation region. This can obscure or shrink the practical target of Back, Save, Done, and the main FAB. The code-level absence is proven; exact overlap is **device verification**.

**Remediation:** Consume `useSafeAreaInsets()` in a shared screen shell. Apply top inset to custom headers and bottom inset to scroll padding/FABs/absolute sheets. Avoid adding the inset twice on native surfaces and test Android 15/16 edge-to-edge with three-button and gesture navigation.

#### UX-002 — Favourites reordering is drag-only and has no assistive alternative

**Evidence:** The only row action calls `useReorderableDrag()` from `onPressIn` (`src/screens/ManageFavouritesScreen.tsx:48-93`). It exposes a button label but no `accessibilityActions`, `onAccessibilityAction`, Move Up/Down buttons, keyboard action, or alternate ordering control. The screen tells users only “Drag to reorder” (`src/screens/ManageFavouritesScreen.tsx:201-224`).

**Affected users/scenario:** TalkBack, Switch Access, Voice Access where drag targeting is unreliable, keyboard users, and people with tremor or limited dexterity.

**Impact:** The screen's sole purpose is unavailable without a precise drag gesture. The labelled “Reorder [name]” button does not perform an action when activated normally.

**Remediation:** Add deterministic Move Up/Move Down accessibility actions and visible controls where appropriate, announce the new position, disable impossible moves, and route both drag and alternate actions through the existing `computeReorder` / transactional persistence path.

#### UX-003 — The Orrery exposes no accessible contact model or actions

**Evidence:** `OrreryCanvas` wraps all contacts, rings, sun, and gestures in one Skia `Canvas` with only a `testID` (`src/components/orrery/OrreryCanvas.tsx:125-148`). `OrreryScreen` passes visual `Group`, `Circle`, planet, and sun nodes without an accessible overlay/list (`src/screens/OrreryScreen.tsx:696-737`). Contact activation and reorder depend on coordinate hit-testing and pan gestures (`src/screens/OrreryScreen.tsx:560-631`).

**Affected users/scenario:** TalkBack, Switch Access, keyboard, voice-control, and users unable to visually locate/tap small planets.

**Impact:** Users cannot discover contact names/statuses, open a profile, understand the center occupant, or reorder rings through assistive technology. A whole top-level feature is effectively blank except for Back and the view toggle.

**Remediation:** Add a synchronized accessible representation—preferably a semantic contact list or overlay nodes with name, status/relationship, ring position, activate, and move-in/out actions. Keep the canvas decorative to screen readers if the semantic layer is authoritative. Announce view changes and reorder results.

#### UX-004 — Capture inline-create looks modal but leaves the contact grid active and Back exits the entire share flow

**Evidence:** Opening inline create only sets `inlineOpen` (`src/screens/CaptureScreen.tsx:458-461`). The lock condition excludes that state (`src/screens/CaptureScreen.tsx:660-665`), so exposed face tiles remain enabled (`src/screens/CaptureScreen.tsx:692-704`). The “sheet” is merely an absolute `View` at the bottom (`src/screens/CaptureScreen.tsx:785-840`, `1145-1153`) with no scrim, focus trap, or Cancel action. Hardware Back handles only multi-select; otherwise it calls `cancelCapture()` and finishes the activity (`src/screens/CaptureScreen.tsx:209-225`).

**Affected users/scenario:** Any user creating a contact from a shared item, especially keyboard/TalkBack users and users who tap outside the small panel expecting dismissal.

**Impact:** A tap on the still-visible grid can save the item to an existing contact instead of the new contact. Back abandons the entire incoming share rather than closing the inline panel. Focus can traverse unrelated background controls.

**Remediation:** Treat inline create as a real modal state: include `inlineOpen` in grid locking, add scrim and explicit Cancel, make Back close the panel first, constrain accessibility focus, and return focus to New Contact on dismissal. Preserve the existing synchronous commit latch.

#### UX-005 — Custom date/number editors violate the settled input contract and allow invalid values to be saved

**Evidence:** The date widget is explicitly a deferred plain `TextInput` (`src/components/field-widgets/DateFieldWidget.tsx:1-6`, `20-38`) rather than the already-installed native date picker. Its parser accepts any leading digit pattern, including impossible dates such as `2026-99-99` (`src/db/field-parsers.ts:68-75`). The number widget only requests a numeric keyboard but writes the raw string unchanged (`src/components/field-widgets/NumberFieldWidget.tsx:1-5`, `19-34`), which does not prevent paste/IME input. Create and edit Save gates validate only name and frequency (`src/screens/create-contact-logic.ts:54-60`, `src/screens/edit-contact-logic.ts:154-160`) and persist custom strings verbatim (`src/screens/create-contact-logic.ts:101-104`, `src/screens/edit-contact-logic.ts:189-192`).

**Affected users/scenario:** Anyone entering custom date/number values, including users relying on constrained input to avoid formatting errors.

**Impact:** New invalid data is accepted and only becomes a later “tap to fix” state; malformed numeric/date values can sort incorrectly and add avoidable repair friction. This conflicts with the settled product rule that date uses a picker and number accepts numeric values only, while still preserving legacy invalid values after a type change.

**Remediation:** Use the native date picker for new edits, validate real calendar dates, sanitize/validate numeric input at the form boundary, and block Save with inline accessible error text. Preserve pre-existing unconvertible values until the user explicitly replaces them; do not conflate migration preservation with permissive new entry.

#### UX-006 — Dashboard cards announce only the name and hide the dashboard's meaningful state

**Evidence:** The outer `Pressable` is the accessible control and explicitly sets `accessibilityLabel={name}` (`src/components/ContactCard.tsx:115-124`). Status, favourite, category, fuel/snippet are rendered as descendants (`src/components/ContactCard.tsx:134-147`, `160-207`), but the explicit parent label replaces the text-derived label of the grouped control. The visible status label on the nested ring cannot make the parent announce the state reliably.

**Affected users/scenario:** TalkBack users scanning the dashboard and Never Contacted list.

**Impact:** Every contact sounds identical except for name. Users cannot hear who needs attention, why a search matched, whether someone is a favourite, category, or the ranked conversation prompt—the information hierarchy the dashboard exists to convey.

**Remediation:** Compose a concise parent label/value from name, status, favourite/category, and current fuel/snippet, with an activation hint such as “Open profile.” Avoid redundant separately focusable decorative avatar/ring nodes. Validate the final announcement order with TalkBack.

#### UX-007 — Contact history is unbounded and fully mounted in a `ScrollView`

**Evidence:** `listTimeline` queries the complete interaction/event union with no `LIMIT` or pagination (`src/db/timeline-read.ts:75-106`). The profile renders that entire array with `.map()` inside one `ScrollView` (`src/screens/ContactProfileScreen.tsx:590-595`, `848-876`) alongside all fuel and profile content.

**Affected users/scenario:** Long-term users and active contacts whose timelines grow over months/years.

**Impact:** React mounts every history row at once. Memory, initial profile load, reconciliation after each log/edit, and accessibility-tree traversal grow linearly without virtualization. The structural growth defect is code-proven; the device threshold is **device verification**.

**Remediation:** Paginate the timeline and virtualize it with `FlatList`/`SectionList`, using a bounded initial window and “load older” behavior. Keep header/profile/fuel content in `ListHeaderComponent`; measure release-build open time and memory at 100, 500, and 1,000 timeline items.

### Medium

#### UX-008 — Read failures are presented as successful empty states on three routes

**Evidence:** Never Contacted catches a read error, writes `[]`, then renders “You've reached everyone / No one is waiting” (`src/screens/NeverContactedScreen.tsx:66-76`, `152-160`). Capture only logs a failed picker read (`src/screens/CaptureScreen.tsx:190-201`) and still constructs a grid containing the New Contact tile (`src/screens/CaptureScreen.tsx:560-572`). Orrery converts any load failure to default sun plus an empty orbit (`src/screens/OrreryScreen.tsx:260-266`), which renders “Your orbit is empty” (`src/screens/OrreryScreen.tsx:740-753`).

**Affected users/scenario:** Users encountering a database/read error, migration mismatch, or transient native failure.

**Impact:** False success copy conceals data and can prompt duplicate contact creation during capture. Users receive no retry path and cannot distinguish “no data” from “couldn't read data.”

**Remediation:** Track `loading | ready | empty | error` explicitly. Preserve prior successful data where safe, show calm route-specific failure copy and Retry, and never expose New Contact as though it were the only option when the capture list failed to load.

#### UX-009 — The first tap on core form actions can be consumed by keyboard dismissal

**Evidence:** Create, Edit, and Compose use `ScrollView` without `keyboardShouldPersistTaps` (`src/screens/CreateContactScreen.tsx:157-162`, `src/screens/EditContactScreen.tsx:436-441`, `src/screens/ComposeScreen.tsx:306-311`). Their primary actions live within the same scroll view; by contrast, `FieldDefForm` explicitly uses `keyboardShouldPersistTaps="handled"` (`src/components/FieldDefForm.tsx:178-182`). No form uses `KeyboardAvoidingView`.

**Affected users/scenario:** Users pressing Save, Copy, Send, picker controls, or other buttons while a text field is focused.

**Impact:** React Native's default scroll behavior can dismiss the keyboard and swallow the first tap, creating a two-tap core workflow and contradicting Orbit's friction-reduction goal. Keyboard overlap may also hide lower actions. Exact behavior varies by platform/IME and is **device verification**.

**Reference:** React Native documents `keyboardShouldPersistTaps="never"` as the default and states that, when dismissal occurs, children do not receive the tap: [React Native ScrollView](https://reactnative.dev/docs/scrollview.html#keyboardshouldpersisttaps).

**Remediation:** Set an intentional tap policy (`handled` is the existing repo precedent), add keyboard-aware layout/insets, and test every primary action with the keyboard open on small Android devices.

#### UX-010 — Continuous Orrery motion ignores the system Reduce Motion preference

**Evidence:** A permanent clock drives ~2.6-second starfield twinkle (`src/components/orrery/OrreryCanvas.tsx:54-63`, `93-101`) and a ~3.1-second sun pulse (`src/components/orrery/SunBody.tsx:58-65`, `82-100`). The loop correctly unmounts off-focus (`src/screens/OrreryScreen.tsx:285-299`), but a repository search found no `AccessibilityInfo.isReduceMotionEnabled`, listener, or equivalent reduced-motion path.

**Affected users/scenario:** Users with vestibular or attention sensitivities who enable Reduce Motion.

**Impact:** The focused Orrery always twinkles/pulses, and view changes always animate. Users cannot request a static presentation.

**Remediation:** Observe the OS Reduce Motion setting and render static midpoint values when enabled; make view changes instantaneous or substantially shortened. Retain the excellent blur/background unmount behavior.

#### UX-011 — Transient success states are not announced and Capture may exit before they are perceived

**Evidence:** Compose renders “Copied” for two seconds as plain text with no live region or accessibility announcement (`src/screens/ComposeScreen.tsx:247-259`, `425-431`). Capture auto-finishes after 1.5 seconds (`src/screens/CaptureScreen.tsx:238-249`) and renders “Saved to…” as plain text (`src/screens/CaptureScreen.tsx:848-860`) without moving focus or announcing it.

**Affected users/scenario:** TalkBack users, users with cognitive/attention impairments, and anyone whose focus remains on a now-disabled background control.

**Impact:** Users may not know Copy/Save succeeded and may repeat the action. Capture can return to the source app before the success text is reached.

**Remediation:** Use a polite live region or `announceForAccessibility`, move focus to the confirmation when appropriate, and do not auto-dismiss until the announcement can complete. Respect reduced motion/time-to-read preferences and keep the existing duplicate-write guard.

#### UX-012 — “Log contact” uses an asynchronous React-state latch that can admit a rapid duplicate write

**Evidence:** The handler reads `logging`, calls `setLogging(true)`, then awaits the write (`src/screens/ContactProfileScreen.tsx:230-265`). React state is not a synchronous mutex; two activations before rerender can enter with the same `logging === false` closure. Capture demonstrates the safer existing pattern with a ref set before the first await (`src/screens/CaptureScreen.tsx:252-269`).

**Affected users/scenario:** Users who double-tap, use switch scanning, or retry because there is no immediate announced success.

**Impact:** Duplicate touchpoints can be created, affecting recency, gravity/intensity, history, and reminders. The user can delete a duplicate, so this is not irreversible.

**Remediation:** Add a synchronous `useRef` in-flight guard, keep the disabled visual state, and add a regression test around the extracted handler/controller logic.

#### UX-013 — Control boundaries do not meet non-text contrast guidance

**Evidence:** The shipped tokens are background `#0B0E1A`, surface `#141828`, border `#2A3048`, and borderStrong `#3C4568` (`src/theme/theme-presets.ts:18-31`). Calculated contrast is approximately 1.09:1 (surface/background), 1.48:1 (border/background), 1.36:1 (border/surface), and 1.88:1 (borderStrong/surface), all below the 3:1 non-text contrast benchmark. Inputs and controls depend on those fills/borders, e.g. dashboard search (`src/screens/HomeScreen.tsx:271-288`) and custom inputs (`src/components/field-widgets/DateFieldWidget.tsx:30-37`).

**Affected users/scenario:** Users with low vision, reduced contrast sensitivity, glare, dim displays, or low-quality panels.

**Impact:** Input boundaries, cards, modal sheets, and inactive selections can blend into the background even though primary and secondary text contrast is generally strong.

**Reference:** WCAG 2.2 SC 1.4.11 requires meaningful visual information used to identify active controls/states to reach 3:1 against adjacent colors, with the documented caveat that a text button may be identifiable without its border: [W3C Understanding Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). The finding applies where Orbit's low-contrast fill/border is the control-identifying cue, particularly text inputs and empty outlined controls—not indiscriminately to every text button.

**Remediation:** Adjust boundary/fill tokens—not individual components—until interactive component boundaries or an equivalent non-color cue reach 3:1 against adjacent colors. Preserve the settled palette character; verify disabled states separately on-device.

#### UX-014 — Dropdown semantics omit current and selected values

**Evidence:** A custom dropdown trigger announces only the field label, not its current value (`src/components/field-widgets/DropdownFieldWidget.tsx:39-56`). Options communicate selection only with accent text and do not set `accessibilityState.selected` (`src/components/field-widgets/DropdownFieldWidget.tsx:89-111`). The Fuel kind modal repeats the option-state omission (`src/components/FuelEditor.tsx:194-217`), while the Settings sun picker shows the correct pattern (`src/screens/SettingsScreen.tsx:762-789`).

**Affected users/scenario:** TalkBack and Switch Access users choosing custom dropdown values or fuel kinds.

**Impact:** Users cannot hear the current choice before opening or identify the selected row after opening. Modal focus containment/restore is also unimplemented in source and needs **device verification**.

**Remediation:** Announce “{label}, {value},” set selected state on option rows, use an appropriate selection role/pattern, and move/restore accessibility focus on open/close. Reuse the Settings picker semantics.

#### UX-015 — Photo crop has no visible loading or terminal decode-failure state

**Evidence:** Crop begins with `ready=false`; after 2.5 seconds it attempts one downscale, but a failed downscale is only logged and sets `downscaleTried` (`src/screens/CropPhotoScreen.tsx:170-197`). The canvas is blank unless ready (`src/screens/CropPhotoScreen.tsx:333-363`) and Use Photo stays disabled (`src/screens/CropPhotoScreen.tsx:423-449`). There is no spinner, explanatory text, timeout error, or retry.

**Affected users/scenario:** Users opening a large, corrupted, unsupported, inaccessible, or slow-to-decode image.

**Impact:** The screen can remain indefinitely blank with an unexplained disabled primary action; Cancel is the only recovery.

**Remediation:** Model decoding/downscaling as loading/error states, expose progress text/indicator, show a terminal accessible error with Retry/Choose another, and announce state changes.

#### UX-016 — Profile has no loading or missing-contact render guard

**Evidence:** The unified loader can return a null header or alert on failure (`src/screens/ContactProfileScreen.tsx:182-215`), but the component always renders the full profile and substitutes empty name/photo (`src/screens/ContactProfileScreen.tsx:590-621`). Message, Log, and Edit remain present (`src/screens/ContactProfileScreen.tsx:685-740`). Compose, in contrast, explicitly renders by `loading/error/missing/ready` state (`src/screens/ComposeScreen.tsx:280-301`).

**Affected users/scenario:** Stale notification/widget/deep link, purged contact, or profile read failure.

**Impact:** Users see a blank but interactive profile and can attempt invalid navigation/writes, receiving secondary errors instead of a clear missing/error state.

**Remediation:** Adopt Compose's explicit state machine, disable actions until ready, and navigate safely or show a retry/back state when the contact is missing.

#### UX-017 — Several important controls have no guaranteed Android-size touch target

**Evidence:** Repeated Back buttons specify only text padding, e.g. Settings `src/screens/SettingsScreen.tsx:904-914`, Manage Favourites `src/screens/ManageFavouritesScreen.tsx:237-247`, and Archived `src/screens/ArchivedContactsScreen.tsx:266-276`. Custom-field action buttons use `paddingVertical: 8` without a minimum (`src/screens/CustomFieldsScreen.tsx:553-563`); field type chips and remove buttons do the same (`src/components/FieldDefForm.tsx:401-425`). The favourites drag handle is approximately glyph-plus-padding only (`src/screens/ManageFavouritesScreen.tsx:285-291`).

**Affected users/scenario:** Android users with motor impairments, tremor, large hands, or one-handed use.

**Impact:** Important navigation/edit targets can fall below the app's own 44dp convention and Android's 48dp recommendation. Actual measured sizes depend on font metrics and are **device verification**.

**Reference:** Android recommends a focusable/touch area of at least 48dp × 48dp for each interactive touch element: [Android Developers — Make apps more accessible](https://developer.android.com/guide/topics/ui/accessibility/apps.html#use-large-simple-controls).

**Remediation:** Centralize a 48dp Android-first minimum target style, use `hitSlop` only as a supplement, and inspect targets with Layout Inspector/accessibility scanner.

#### UX-018 — Fixed horizontal groups are likely to clip or crowd at large font scales

**Evidence:** Never Contacted forces three labeled sort buttons into one non-wrapping row (`src/screens/NeverContactedScreen.tsx:107-150`, `211-224`). Profile forces three snooze buttons into one row (`src/screens/ContactProfileScreen.tsx:750-778`, `999-1013`). Archived puts the name plus “Restore” and “Delete permanently” into non-wrapping horizontal rows (`src/screens/ArchivedContactsScreen.tsx:216-252`, `297-319`). Custom frequency places input plus three unit buttons in one row (`src/components/FrequencyPicker.tsx:159-209`, `246-271`).

**Affected users/scenario:** Users at large Android font scales, narrow/split-screen devices, translated copy, and display-size magnification.

**Impact:** Text can truncate, controls can compress/overflow, and destructive labels can become hard to distinguish. This is a code-indicated risk requiring **device verification**.

**Remediation:** Allow wrap/stack breakpoints, avoid `numberOfLines={1}` on essential choices, and test 1.0x, 1.3x, 1.5x, and 2.0x font scale at 320–360dp width.

#### UX-019 — Settings persistence failures are silent

**Evidence:** Notification-setting writes catch and only log (`src/screens/SettingsScreen.tsx:241-253`); star-color and sun-occupant writes do the same (`src/screens/SettingsScreen.tsx:191-229`). Controls have no busy state, error copy, or retry.

**Affected users/scenario:** Anyone whose local settings write or follow-up read fails.

**Impact:** A tap can appear ignored or snap back with no explanation. Repeated presses can overlap writes, and users may believe privacy/notification choices changed when they did not.

**Remediation:** Disable the affected control while saving, show an accessible failure message, restore persisted truth, and allow retry. Keep permission-denied messaging distinct from persistence failure.

#### UX-020 — Rendered UI, accessibility, and navigation have no automated coverage

**Evidence:** Vitest is explicitly a Node, render-free environment (`vitest.config.ts:4-15`). The sole `.test.tsx` file says it imports a React-Native-free helper and performs no render (`src/components/ContactCard.test.tsx:1-14`). `package.json:34-42` contains no React Native Testing Library or renderer dependency. There is no Detox, Maestro, Appium, screenshot, accessibility, or E2E configuration in the repository.

**Affected users/scenario:** All users indirectly; regressions in the 13 screens and 30 TSX component files can pass CI-like checks.

**Impact:** Labels, disabled/selected state, focus order, route wiring, keyboard behavior, error/empty states, modal behavior, and duplicate taps are unprotected. Existing 1,009 tests provide strong data/pure-logic confidence but not interaction confidence.

**Remediation:** Add rendered component tests for shared controls and critical state machines, then a small Android E2E smoke suite for create/log/edit/archive/restore, share capture, notification/widget deep links, and accessibility assertions. Keep pure logic tests fast and separate.

#### UX-021 — Quality checks are not a reliable single-command gate

**Evidence:** Package scripts expose only start/platform commands, color check, tests, and postinstall (`package.json:44-51`); there is no `lint`, `format:check`, `typecheck`, `build`, or aggregate `check`. `biome.json:8-12` uses a deprecated configuration field. On this snapshot `npx biome check .` exits nonzero with 28 errors, including formatting/import-order violations and plugin-source diagnostics.

**Affected users/scenario:** Maintainers and every release indirectly.

**Impact:** A green `npm test` does not mean the configured static checks pass, and there is no discoverable release-quality command or CI workflow to prevent drift. Vitest also warns that its config loading mode will become unsupported without an ESM adjustment.

**Remediation:** Fix current Biome findings, migrate the config, add explicit `typecheck`, `lint`, `format:check`, and `check` scripts, resolve the Vitest config warning, and run the aggregate gate in CI plus an Expo/native build validation.

#### UX-022 — Opening timeline refinement does not move the user to the editor

**Evidence:** “Add detail” only updates edit state (`src/screens/ContactProfileScreen.tsx:373-387`). Every timeline row renders first (`src/screens/ContactProfileScreen.tsx:848-876`), then the refine panel is appended after the entire timeline (`src/screens/ContactProfileScreen.tsx:879-933`). There is no scroll-to, focus, modal, or inline placement next to the chosen item.

**Affected users/scenario:** Users editing a recent item on a long timeline, TalkBack users, and keyboard users.

**Impact:** Activating Add Detail can appear to do nothing because the editor opens far below the viewport; assistive focus remains on the original row.

**Remediation:** Open a focused modal/sheet or render the editor adjacent to the selected row. Move accessibility focus to its heading/first field and restore focus on cancel/save.

### Low

#### UX-023 — Several important text inputs rely on placeholder text instead of a durable accessible name

**Evidence:** Dashboard search has no `accessibilityLabel` (`src/screens/HomeScreen.tsx:271-288`); Compose draft has a visible section heading but no programmatic input label (`src/screens/ComposeScreen.tsx:378-398`); Capture search, inline name, and note inputs likewise rely on placeholders (`src/screens/CaptureScreen.tsx:625-645`, `785-815`, `862-880`). The URL input also has only `https://…` (`src/components/PhotoSourcePicker.tsx:282-305`).

**Affected users/scenario:** Screen-reader and voice-control users, especially after text entry causes placeholder text to disappear.

**Impact:** Depending on native announcement heuristics, fields may be described by transient or ambiguous text (“Name”, “https://…”), making re-navigation and voice targeting less reliable.

**Remediation:** Give every input a durable accessible name matching its visible label/purpose; preserve helpful placeholder text as a hint, not the sole name.

## Positive patterns worth preserving

- **Typed and reachable navigation:** all 13 registered routes in `src/navigation/RootNavigator.tsx:52-77` have a traced entry path; params are serializable and strongly typed. Capture, notification, and widget gates are ready-gated instead of racing navigation startup.
- **Strong token discipline:** `npm run check:colors` passes. Literal colors are centralized in `src/theme/theme-presets.ts`, and native/Skia/widget surfaces consume tokens consistently.
- **Text contrast is generally strong:** calculated primary/background contrast is ~15.9:1, secondary/background ~6.3:1, and accent/background ~6.3:1. UX-013 concerns component boundaries, not the overall text palette.
- **Status is not color-only visually:** dashboard status uses both token color and escalating ring weight (`src/components/ContactCard.tsx:109-146`), a useful color-vision-deficiency redundancy. Its semantic aggregation needs UX-006's fix.
- **Destructive actions respect product decisions:** Archive is reversible and separated from permanent delete. Archived deletion presents impact-aware copy and a destructive confirm (`src/screens/ArchivedContactsScreen.tsx:128-168`); photo removal also confirms irreversibility.
- **Custom-field type changes preserve data:** read-time parsing flags invalid legacy values instead of silently clearing/coercing them (`src/db/field-parsers.ts:1-18`), and profile offers a consistent tap-to-fix state.
- **Animation/per-frame architecture is careful:** Orrery/Crop use shared values rather than React state per frame, and the ambient Orrery clock is fully unmounted on blur/background (`src/screens/OrreryScreen.tsx:285-299`).
- **Duplicate-write protection exists in high-risk Capture paths:** a synchronous ref is set before awaits (`src/screens/CaptureScreen.tsx:252-269`), and the post-save grid is locked. This should be reused for Profile logging.
- **Home handles state well:** dashboard reads cancel stale work and distinguish loading result causes, search-empty, filter-empty, first-run, hidden populations, and retryable error (`src/screens/HomeScreen.tsx:137-169`, `396-474`).
- **Pure-logic test architecture is substantial:** 83 files / 1,009 tests pass, including database transactions, form builders, parsers, sorting, geometry, capture/compose logic, notifications, photos, widget projection, and theme resolution. TypeScript strict mode and color checking pass.
- **Widget implementation respects touch geometry:** widget actions explicitly use a 48dp height (`src/services/widget/widget-render.tsx:84-99`, `309-360`) and the empty widget deep-links to the setup surface.

## Coverage matrix: automation versus required device UAT

| Area | Pure/static automation now | Rendered UI automation now | Device/human verification now | Recommended next coverage |
|---|---|---|---|---|
| Database/form rules | Strong Vitest coverage; current suite passes | None | Not required for most pure rules | Preserve unit suite; add controller integration around write latches |
| Navigation/deep links | Pure widget-link tests; types pass | None | Not executed | Android E2E for cold/warm notification, widget, and share entries |
| Dashboard cards/filters | Empty-state and ring helpers tested | None | Not executed | Render tests for labels/states; TalkBack card traversal; screenshot at font scales |
| Create/Edit/custom fields | Form builders and field parsers tested | None | Not executed | Render validation/error tests; IME/picker/photo flows on device |
| Profile/log/timeline/fuel | DAO and refine logic tested | None | Not executed | Double-tap test, virtualized timeline perf test, TalkBack focus on refine/delete |
| Archive/restore/purge | DAO/purge logic tested | None | Not executed | End-to-end confirmation copy, cancel/confirm, cleanup failure behavior |
| Favourites reorder | Reorder math and rank writes tested | None | Not executed | Drag plus accessibility-action E2E and announcement validation |
| Compose | Resolver/pure logic tested | None | Not executed | SMS available/unavailable, keyboard, Copy live announcement, missing contact |
| Capture | Payload/DAO logic tested | None | Not executed | Real share intent; single/multi/inline/note/Back; TalkBack and duplicate taps |
| Crop/photo | Geometry/storage/URL logic tested | None | Not executed | Large/corrupt images, gestures, decode failure, screen reader state |
| Orrery | Geometry/ring/reorder/sun logic tested | None | Not executed | Accessible semantic layer, reduced motion, hit targets, frame/memory profiling |
| Notifications | Scheduling/action logic tested | None | Not executed | Permission variants, lock-screen privacy, action/deep-link UAT |
| Android widget | Data/color/mark/photo helpers tested; render typechecks | None | Not executed | Small/large resize, TalkBack, all click targets, reboot/update behavior |
| Theme/contrast | Token resolution and color-literal guard pass | None | Not executed | Automated contrast assertions plus low-brightness/glare visual check |
| Static quality | TypeScript and colors pass; Biome fails | N/A | N/A | One aggregate CI gate, Expo/native build check, zero diagnostics |

## Prioritized device test checklist

### P0 — Block release/accessibility sign-off

- [ ] On Android 15/16, test every route with cutout + gesture navigation and three-button navigation. Confirm headers and all absolute bottom controls clear system insets.
- [ ] With TalkBack, traverse a dashboard card and confirm name, status, favourite, category, and current fuel/search reason are announced once in a useful order.
- [ ] With TalkBack and Switch Access, reorder first/middle/last favourites without dragging; verify the new position is announced and persists after relaunch.
- [ ] With TalkBack, discover every Orrery contact, hear status/relationship/ring position, open Profile, and reorder using non-coordinate actions.
- [ ] In Capture, open New Contact, tap the exposed background, press hardware Back, and traverse with TalkBack. Confirm the grid cannot save while inline create is open, Back closes only the panel, and focus restores correctly.
- [ ] Enter/paste malformed number and impossible date values in Create/Edit custom fields. Confirm Save is blocked with announced inline errors and valid date entry uses the native picker.

### P1 — Core usability and resilience

- [ ] At Android font scales 1.0x, 1.3x, 1.5x, and 2.0x on 320/360dp width, test Never Contacted sort, Profile snooze chips, Archived rows, custom frequency units, headers, modals, and widget text.
- [ ] With keyboard open, press Create Save, Edit Save, Compose Copy/Send, Capture Create & Save, photo URL submit, and profile refine Save. Each must work on the first tap and remain visible above the IME.
- [ ] Enable Reduce Motion before opening Orrery. Verify star/sun animation is static and view switching does not animate.
- [ ] Use TalkBack to Copy in Compose and Save in Capture. Verify success is announced before it disappears/returns to the source app.
- [ ] Rapidly double-activate Log Contact and confirm exactly one interaction is created.
- [ ] Open Profile with 100, 500, and 1,000 timeline items in a release build. Record time-to-interactive, dropped frames, memory, TalkBack tree latency, and post-log refresh cost.
- [ ] Force read failures for Never Contacted, Capture picker, and Orrery. Confirm explicit error/retry states replace false-empty copy and Capture cannot create accidental duplicates.
- [ ] Test crop with normal, very large, corrupt, unsupported, and inaccessible image URIs. Verify progress, error, Retry/Choose Another, Cancel, and focus announcements.
- [ ] Open every dropdown/modal with TalkBack. Confirm title/current selection, selected row state, focus containment, Back dismissal, and focus restoration.
- [ ] Run Android Accessibility Scanner and manually measure Back, custom-field action, option-remove, and reorder-handle targets; require at least 48dp practical targets.
- [ ] Inspect inputs/cards/sheets at low brightness and in glare; confirm component boundaries remain distinguishable while retaining the approved palette.

### P2 — Complete product-quality coverage

- [ ] Exercise every loading, empty, error, disabled, saving, success, cancel, and retry state in the coverage map.
- [ ] Verify archive → restore and archive → permanent-delete confirmation, including singular/plural impact copy and post-commit cleanup failure.
- [ ] Test notification permission denied/permanently denied, all privacy settings, quiet hours, lock-screen copy, notification actions, and stale-contact deep links.
- [ ] Resize the Android widget through small/large breakpoints; test TalkBack reading order and Mark/Profile/Log/Message/empty-state actions.
- [ ] Test Voice Access, Switch Access, landscape/multi-window where supported, RTL mirroring, long contact/category/dropdown names, and non-Latin initials.
- [ ] Run the future rendered/E2E suite plus `npm test`, `typecheck`, `lint`, `format:check`, color check, and native build from one CI command.

## Closing priorities

1. Make the three inaccessible core surfaces usable without sight/drag: Manage Favourites, Orrery, and dashboard cards (UX-002, UX-003, UX-006).
2. Fix screen geometry and Capture modal/write scope (UX-001, UX-004).
3. Enforce the settled typed-field input behavior and virtualize profile history (UX-005, UX-007).
4. Add explicit error/loading/success semantics and keyboard/reduced-motion handling (UX-008 through UX-011, UX-015, UX-016).
5. Establish rendered UI/E2E coverage and a passing aggregate quality gate (UX-020, UX-021).

**Final count:** 0 Critical, 7 High, 15 Medium, 1 Low, 0 Info — **23 findings total**.  
**Report:** `docs/audits/2026-08-21/UI-ACCESSIBILITY-QUALITY.md`
