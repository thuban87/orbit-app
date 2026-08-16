# Phase 9: Compose Screen & SMS Handoff - Research

**Researched:** 2026-08-16
**Domain:** React Native / Expo SDK 57 — native handoff (SMS composer + clipboard), additive react-navigation route, fuel read reuse, Android-first, local-first
**Confidence:** HIGH

## Summary

This phase adds a single new screen — `ComposeScreen` — plus a "Message" entry button on the
profile and two first-party native modules (`expo-sms`, `expo-clipboard`). The technical surface is
small and almost entirely **reuse**: the read path already exists (`getRankedFuel` in
`src/db/fuel-read.ts` returns exactly the fuel the compose screen must show, with the
never-transmitted `off_limits` rows excluded *in-query*), the navigation shell already follows a
proven additive-route pattern (NeverContacted / ManageFavourites), and the screen chrome (Back pill,
section headings, Avatar, filled-accent buttons) is a verbatim copy of shipped idioms catalogued in
`09-UI-SPEC.md`. The only genuinely new code is the two native calls and the capability state matrix
that decides which controls render.

The two native modules are confirmed against the official Expo SDK 57 docs and the npm registry:
`expo-sms@57.0.1` and `expo-clipboard@57.0.1`, both installed via `npx expo install`. **Neither ships
a config plugin**, so `app.config.ts`'s `plugins` array does **not** change — but both add autolinked
native code, so a full `expo prebuild --clean` + release build on `droid` is mandatory before
on-device UAT (a Metro JS reload will not pick them up). On Android `sendSMSAsync` always resolves
`{ result: 'unknown' }` and opens the default SMS app pre-filled via `ACTION_SENDTO`; neither module
needs any Android permission (no `SEND_SMS`).

**Primary recommendation:** Reuse `getRankedFuel` verbatim for the read-only fuel list (render **all**
returned rows, not just `rows[0]`) — do **not** build a new "full fuel minus off_limits" projection,
because a hand-rolled off_limits-only projection would re-admit unconfirmed `source='ai'` rows onto a
transmittable surface. Widen `getContactHeader` additively to return `phone`. Register `Compose`
additively. Implement Back→dashboard with `navigation.reset` to `Home` **plus** a `BackHandler`
override for the Android hardware Back button.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Show contact's full fuel (off_limits excluded) | Database / Storage (`fuel-read.ts` `getRankedFuel`) | UI (read-only cards) | The never-transmitted invariant lives in SQL, never a UI filter (HANDOFF §14 / FUEL-02) |
| Editable message draft | UI (local `TextInput` state) | — | In-memory only, no persistence (CONTEXT) |
| Send → SMS composer | Device / native module (`expo-sms`) | UI (button gating) | OS `ACTION_SENDTO` intent; app cannot observe the result |
| Copy → clipboard | Device / native module (`expo-clipboard`) | UI (transient confirm) | Guaranteed handoff; OS clipboard |
| Phone source + capability gate | Database (`contacts.phone`) + Device (`isAvailableAsync`) | UI (state matrix) | Data drives which controls render |
| Route registration + Back→dashboard | Frontend (react-navigation native-stack) | — | Serializable params, entry-agnostic |
| "Add number" affordance | Frontend (navigate to `Edit`) | — | Routes to existing edit form (CMP-03) |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `expo-sms` | npm | mature (SDK-tracked; `sdk-50`…`sdk-57` dist-tags) | first-party Expo module | github.com/expo/expo (packages/expo-sms) | OK | Approved |
| `expo-clipboard` | npm | mature (SDK-tracked) | first-party Expo module | github.com/expo/expo (packages/expo-clipboard) | OK | Approved |

- Both `latest` = `57.0.1`, `next` = `57.0.1`; SDK-57 line current. `[VERIFIED: npm registry — npm view]`
- **No `postinstall` script** on either package (checked `scripts.postinstall` → empty). `[VERIFIED: npm view]`
- Both are unscoped `expo-*` names owned/maintained by the Expo team, part of the Expo SDK monorepo, and referenced by the official docs. `[VERIFIED: docs.expo.dev/versions/latest/sdk/sms + /clipboard]`

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Install both with `npx expo install expo-sms expo-clipboard` — this resolves the SDK-57-pinned
versions (`~57.0.x`, matching every other `expo-*` dep in `package.json`), not the npm `latest`.*

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMP-01 | Compose screen shows a contact's full fuel + editable draft; Send hands off to SMS composer; Copy always works | Fuel via `getRankedFuel` (all rows, off_limits+ai+blank excluded in-query); draft = local multiline `TextInput`; Send via `expo-sms.sendSMSAsync`; Copy via `expo-clipboard.setStringAsync` |
| CMP-02 | Reachable from profile now (later from notification/widget/AI); Back → dashboard | "Message" button on `ContactProfileScreen` → `navigate("Compose",{contactId})`; `Compose` route registered additively; Back→dashboard via `navigation.reset` to `Home` + `BackHandler` override; entry-agnostic serializable `{contactId}` param |
| CMP-03 | Degrades gracefully with no phone number (Copy works; "add number" affordance appears) | `contacts.phone` via widened `getContactHeader`; no-phone → Send hidden, Copy promoted to primary, "Add a phone number" link → `navigate("Edit",{contactId})` |
</phase_requirements>

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Send uses `expo-sms`** (`sendSMSAsync`) — chosen over RN-core `Linking` `sms:` on the merits:
  correct `isAvailableAsync()` capability detection (avoids the Android-11 `canOpenURL`
  package-visibility trap) and native address+body marshalling (no URL-encoding corruption of `&`,
  `#`, newlines, emoji). Prefill reliability is identical to Linking; neither sends silently; **neither
  needs `SEND_SMS`**.
- **Copy uses `expo-clipboard`** (`setStringAsync`) — Copy is the *guaranteed* handoff; Send is
  best-effort (the SMS app may or may not honor the pre-filled body).
- Both are native modules ⇒ this phase requires a full **`expo prebuild --clean` + release build** for
  on-device UAT (not a JS-only Metro reload).
- Phone number sourced from `contacts.phone`. **No phone ⇒** Send hidden/disabled, Copy still works,
  "add number" affordance routes to EditContact (CMP-03).
- The draft opens **blank** (empty editable multiline field). No greeting template, no cross-session
  persistence. Phase 14's AI Suggest fills it later.
- **Full fuel, read-only** — all fuel kinds **except `off_limits`**, shown as a read-only reference.
  Editing fuel stays on the profile's `FuelEditor`. `off_limits` excluded **in-query** (never-transmitted
  invariant, HANDOFF §14 / REQUIREMENTS FUEL-02).
- New **`Compose` route registered additively** in `RootStackParamList`, **serializable params only**
  (`{ contactId }`), self-fetching — so notification(11)/widget(12)/AI(14) can navigate with just a
  contact id.
- **Back → dashboard** (CMP-02) — navigation to Home, not a stack pop to the profile.
- Entry from profile: a primary **"Message"** button on `ContactProfileScreen`.

### Claude's Discretion
- Exact layout/spacing; whether to reuse an existing fuel renderer vs a compose-specific read-only one;
  draft `TextInput` sizing; the precise mechanism for "Back → dashboard" (navigation reset vs
  `navigate("Home")`); the "add number" affordance styling; whether Send is hidden vs
  disabled-with-hint when no phone; extraction of any number-formatting / draft logic into a
  node-tested `-logic.ts` module. All colours via theme tokens.

### Deferred Ideas (OUT OF SCOPE)
- **AI Suggest on compose** — Phase 14 (this screen is the host; leave layout room).
- **Notification / widget entry points into compose** — Phases 11/12 (built entry-agnostic now, wired
  later).
- **SMS send-confirmation tracking** — not pursued (Android's composer returns `unknown`; the app can't
  know whether a text was actually sent — this is why Copy is the guaranteed handoff).
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **Local-first / no network on any read path.** `isAvailableAsync()` is a device-capability check, not
  a network call — it is offline-safe. No other network is introduced.
- **All colours resolve through theme tokens** (`useTheme().colors.*`); zero hex literals outside
  `src/theme/theme-presets.ts`; `npm run check:colors` gates this.
- **Never drive animation from React state.** The transient "Copied" confirmation is a single
  `setState` + `setTimeout` toggle — not a per-frame animation.
- **Screens own their own Back chrome** (`headerShown:false`, shipped since 04-01).
- **Serializable-only route params; additive route registration** — no callback params.
- **Correctness-critical logic extracted into pure node-tested `-logic.ts` modules**; `.tsx` screens are
  device-UAT.
- **`formatLocalDate()` / local wall-clock** conventions — not relevant here (no new date writes), but
  the reused `formatFuelAge(created_at, now)` already uses local parsing.
- **Never push; no git worktrees.** Reads + one RESEARCH.md write only (this agent). Executors: commit
  in place on `main`.
- **Compose never marks a contact contacted** — no interaction/log row is written from Send or Copy.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-sms` | `~57.0.1` | Send handoff — opens default SMS app pre-filled | First-party Expo module; correct `isAvailableAsync()` capability detection + native body marshalling (locked decision) |
| `expo-clipboard` | `~57.0.1` | Copy handoff — writes draft to clipboard | First-party Expo module; the guaranteed handoff |
| `@react-navigation/native-stack` | `^7.18.8` (installed) | `Compose` route + Back control | The app's shipped nav shell (Phase 4) |

### Supporting (all already installed — reuse, do not add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native` core | `0.86.2` | `View`/`Text`/`TextInput`/`Pressable`/`ScrollView`/`Alert`/`BackHandler` | Every UI primitive + hardware-Back override |
| `@react-navigation/native` | `^7.3.16` | `useFocusEffect` for the `BackHandler` lifecycle | Android hardware Back binding |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-sms` | RN-core `Linking.openURL("sms:…?body=…")` | REJECTED on merits (CONTEXT): no reliable capability detection (Android-11 `canOpenURL` visibility trap), URL-encoding corrupts `&`/`#`/newlines/emoji in the body |
| Reuse `getRankedFuel` | New `getFullFuelExcludingOffLimits` projection | A projection excluding *only* off_limits would re-admit unconfirmed `source='ai'` rows to a transmittable surface — avoid; `getRankedFuel` already excludes off_limits **and** ai **and** blank |

**Installation:**
```bash
npx expo install expo-sms expo-clipboard
```

**Version verification (done this session):** `npm view expo-sms version` → `57.0.1`; `npm view
expo-clipboard version` → `57.0.1`; both carry an `sdk-57`/`latest`/`next` = `57.0.1` line and no
`postinstall` script. `[VERIFIED: npm registry]`

## Architecture Patterns

### System Architecture Diagram

```
                     ContactProfileScreen
                    (new "Message" button)
                            │
             navigate("Compose", { contactId })   ◄── Phases 11/12/14 also enter here
                            │                          (notification tap / widget / AI Suggest)
                            ▼
                    ┌──────────────────┐
                    │   ComposeScreen   │  self-fetching, entry-agnostic
                    │  route param:     │  params = { contactId }  (serializable only)
                    │   { contactId }   │
                    └──────────────────┘
                            │
        ┌───────────────────┼───────────────────────────┐
        ▼                   ▼                             ▼
  getContactHeader     getRankedFuel               isAvailableAsync()
  (name, photo,        (ALL eligible rows;         (expo-sms; device
   modified_at,        off_limits + ai +            capability, offline)
   +phone [NEW])        blank excluded IN-QUERY)          │
        │                   │                             │
        ▼                   ▼                             ▼
   header state       read-only fuel cards        smsAvailable state
        │              (kind label, text,               │
        │               optional label, age)            │
        └───────────────────┬─────────────────────────┬─┘
                            ▼                          ▼
                  resolveComposeControls(hasPhone, smsAvailable)   ◄── pure, node-tested
                            │                          (compose-logic.ts, recommended)
        ┌───────────────────┼───────────────────────────┐
        ▼                   ▼                             ▼
   Send (accent)      Copy (accent/primary)       Add-a-phone-number link
   sendSMSAsync       setStringAsync              navigate("Edit",{contactId})
   (phone, draft)     (draft) → "Copied" 2s
        │
        ▼
   Android ACTION_SENDTO → default SMS app pre-filled
   (resolves { result: 'unknown' }; NO log row written)

   Back control (pill) + Android hardware Back
        └──► navigation.reset({ index:0, routes:[{name:"Home"}] })  → dashboard
```

File-to-implementation mapping is in the Component Responsibilities table below, not in the diagram.

### Recommended Project Structure
```
src/
├── screens/
│   └── ComposeScreen.tsx        # new — the entry-agnostic compose surface
├── logic/
│   └── compose-logic.ts         # new (recommended) — pure control-state resolver + tests
├── navigation/
│   ├── types.ts                 # edit — add `Compose: { contactId: number }`
│   └── RootNavigator.tsx        # edit — add <Stack.Screen name="Compose" …/>
├── db/
│   ├── fuel-read.ts             # REUSE getRankedFuel unchanged
│   └── contact-read.ts          # edit — widen getContactHeader to return `phone`
└── screens/ContactProfileScreen.tsx  # edit — add "Message" button above "Log contact"
```

### Component Responsibilities
| File | Responsibility | Change |
|------|----------------|--------|
| `src/screens/ComposeScreen.tsx` | Self-fetch header + fuel + SMS capability; render fuel/draft/actions; Send/Copy/Back | **new** |
| `src/logic/compose-logic.ts` | `resolveComposeControls({hasPhone, smsAvailable})` → discriminated control state | **new (recommended)** |
| `src/navigation/types.ts` | `Compose: { contactId: number }` in `RootStackParamList` | edit (additive) |
| `src/navigation/RootNavigator.tsx` | `<Stack.Screen name="Compose" component={ComposeScreen} />` | edit (additive) |
| `src/db/contact-read.ts` | `getContactHeader` widened to also select+return `phone` | edit (additive) |
| `src/db/fuel-read.ts` | `getRankedFuel` — the compose fuel read | **reuse unchanged** |
| `src/screens/ContactProfileScreen.tsx` | "Message" button (filled-accent) above "Log contact" → `navigate("Compose",{contactId})` | edit |

### Pattern 1: Additive route registration (verified against shipped code)
**What:** Register `Compose` exactly like `NeverContacted` / `ManageFavourites` were.
**When to use:** This phase — serializable param, `initialRouteName:"Home"` and existing routes untouched.
**Example:**
```typescript
// src/navigation/types.ts — append after ManageFavourites (verified line 55)
export type RootStackParamList = {
  // …existing routes unchanged…
  ManageFavourites: undefined;
  /** The entry-agnostic compose surface (CMP-01/02/03). Serializable param ONLY
   *  so notification(11)/widget(12)/AI(14) open it with just a contact id. */
  Compose: { contactId: number };
};

// src/navigation/RootNavigator.tsx — add the screen (import ComposeScreen at top)
<Stack.Screen name="Compose" component={ComposeScreen} />
```

### Pattern 2: Reuse `getRankedFuel` for the read-only fuel list (verified)
**What:** Call `getRankedFuel(exec, contactId)` and render **every** returned row (the profile only
uses `rows[0]`; compose uses all of them). Do NOT call `listFuelForEditor` (it deliberately includes
off_limits — the ONE editor read).
**Why it is exactly right:** `RANKED_FUEL_EXCLUSIONS` (fuel-read.ts:133) enforces, in-query:
`kind != 'off_limits' AND source != 'ai' AND` non-blank text. off_limits is the never-transmitted
invariant; excluding unconfirmed `source='ai'` keeps a proposal off a transmittable surface until
confirmed (matches T-07-03 / AI-03); blank rows are dropped. Rows come back ranked (kind priority →
`created_at DESC` → `id DESC`), which is a sensible reference order.
**Example:**
```typescript
// Source: verified src/db/fuel-read.ts:149 getRankedFuel; src/services/fuel-age.ts:92 formatFuelAge
const exec = getExecutor();
const [header, fuel] = await Promise.all([
  getContactHeader(exec, contactId),        // widened to include phone (below)
  getRankedFuel(exec, contactId),           // ALL eligible rows, off_limits excluded IN-QUERY
]);
// Render each row as a read-only card: kind→human label, text, optional label,
// formatFuelAge(row.created_at, localDateTime()). Empty array → "No fuel yet." empty state.
```
Kind → human label mapping is fixed in `FuelEditor.KIND_OPTIONS` (recent→"Recent", topic→"Topic",
fact→"Fact", gift→"Gift idea"; off_limits→"Off-limits" never appears here). Reuse those exact strings.

### Pattern 3: Widen `getContactHeader` additively for `phone` (verified-safe)
**What:** Add `phone` to `getContactHeader`'s SELECT + return type — the same additive widening that
08-06 did for `favourite_rank`.
**Why safe:** Its two other callers read the result **field-wise** — `ContactProfileScreen` defines its
own local `Header` type and destructures specific fields (verified lines 100–112), and
`EditContactScreen`'s photo refresh reads only `photo`/`modified_at`. `contact-read.test.ts` asserts
fields individually. Adding a field breaks neither typecheck nor tests (the 08-06 MEDIUM-3 argument).
**Example:**
```typescript
// Source: verified src/db/contact-read.ts:65-103
// SELECT id, name, rarely_responds, archived_at, photo, modified_at, favourite_rank, phone FROM contacts WHERE id = ?
// return type gains: phone: string | null
```
Alternative (heavier, not recommended): `getContactForEdit` returns phone but also joins categories and
loads all custom values + links — overkill for a header that needs name/photo/phone.

### Pattern 4: Back → dashboard (both software + hardware Back)
**What:** The Back pill and the Android hardware Back button must both land on the dashboard, never pop
to the profile — and must be robust to entry-agnostic future callers (a notification tap where Home is
not in the back stack).
**Recommendation:** `navigation.reset({ index: 0, routes: [{ name: "Home" }] })`. This collapses the
stack to a single Home screen regardless of how Compose was reached (unlike `popToTop()`, which assumes
Home is the stack root, and unlike `navigate("Home")`, which can leave Compose beneath Home). For the
profile-only entry wired this phase, `popToTop()` would also work — but `reset` is the entry-agnostic
choice the screen is explicitly designed for (CONTEXT grants this to Claude's discretion).
**Example:**
```typescript
// Source: react-navigation native-stack; verified BackHandler is RN-core (0.86.2)
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

const goHome = useCallback(() => {
  navigation.reset({ index: 0, routes: [{ name: "Home" }] });
}, [navigation]);

// Android hardware Back: native-stack's default pops to Profile — override it while focused.
useFocusEffect(
  useCallback(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goHome();
      return true; // consume — prevents the default stack pop
    });
    return () => sub.remove();  // RN 0.65+: addEventListener returns { remove }
  }, [goHome]),
);
```

### Pattern 5: Send / Copy native calls
```typescript
// Source: docs.expo.dev/versions/latest/sdk/sms (SDK 57) + /clipboard (SDK 57)
import * as SMS from "expo-sms";
import * as Clipboard from "expo-clipboard";

// Capability probe once on mount (offline; false in iOS sim/browser, true on a real phone with telephony)
const available = await SMS.isAvailableAsync();      // Promise<boolean>

// Send (only when phone present && available): opens the default SMS app pre-filled
try {
  await SMS.sendSMSAsync(phone, draft);              // Android → resolves { result: 'unknown' }
  // DO NOT show "sent", DO NOT write any interaction/log row (compose never marks contacted).
} catch (err) {
  Alert.alert("Couldn't open your messages app", "Your message is ready to copy instead.");
}

// Copy (always available): guaranteed handoff
try {
  await Clipboard.setStringAsync(draft);             // Android → resolves true
  // transient "Copied" for ~2s via a single setState + setTimeout (NOT a per-frame animation)
} catch {
  Alert.alert("Couldn't copy", "Please try again.");
}
```

### Anti-Patterns to Avoid
- **Reading fuel via `listFuelForEditor` for compose.** That is the ONE read that surfaces off_limits
  (fuel-read.ts:19-24). Using it on a transmittable surface leaks the never-transmitted rows. Use
  `getRankedFuel`.
- **Filtering off_limits in the component.** The invariant lives in SQL, never a `.filter()` a refactor
  could remove (HANDOFF §14 / T-07-02).
- **Writing an interaction row on Send/Copy.** Compose never marks a contact contacted; logging stays a
  separate explicit profile action (UI-SPEC "Send behaviour").
- **Rendering a "Message sent!" confirmation.** Android returns `unknown`; the app cannot know. Copy is
  the guaranteed handoff.
- **Adding `expo-sms`/`expo-clipboard` to `app.config.ts` plugins.** Neither ships a config plugin;
  adding a bogus entry is a prebuild error (like the deduped-plugins fix in 01-01).
- **`Linking` `sms:` scheme** for Send. Explicitly rejected (CONTEXT).
- **A per-frame animation for "Copied".** CLAUDE.md forbids state-driven animation; use setState+timeout.
- **Callback route params** (e.g. an `onDone` function). Native-stack serialization + entry-agnostic
  design require `{ contactId }` only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SMS capability detection | A `Linking.canOpenURL("sms:")` probe | `SMS.isAvailableAsync()` | Android-11 package-visibility makes `canOpenURL` unreliable (the trap the CONTEXT decision names) |
| SMS body encoding | URL-encode the draft into an `sms:?body=` string | `SMS.sendSMSAsync(phone, draft)` | Native marshalling; no `&`/`#`/newline/emoji corruption |
| Clipboard write | A native module or `Linking` hack | `Clipboard.setStringAsync(draft)` | First-party, permissionless, one call |
| Fuel exclusion of off_limits | A component `.filter(r => r.kind !== 'off_limits')` | `getRankedFuel` (in-query exclusion) | Structural access control; a UI filter can be refactored away |
| Fuel age string | New date math | `formatFuelAge(created_at, now)` (fuel-age.ts) | Node-tested, DST-safe, local-wall-clock, no UTC off-by-one |
| Contact phone read | A new bespoke query | Widen `getContactHeader` | Additive, mirrors the 08-06 favourite_rank widening |
| Ranked fuel line component | New renderer | `RankedFuelLine` idiom / read-only card mirroring `FuelEditor` chrome | Shipped chrome, token-clean |

**Key insight:** Almost every "new" piece of this phase already exists in a shipped, tested form. The
net-new code is two native calls + one pure control-state resolver.

## Common Pitfalls

### Pitfall 1: Prebuild required — a Metro reload will NOT surface the native modules
**What goes wrong:** After `npm install`, the executor tests via a JS Metro reload and Send/Copy throw
"native module not found" (or the app crashes on import).
**Why it happens:** `expo-sms`/`expo-clipboard` add autolinked native code; the installed release APK
does not contain it until `android/` is regenerated.
**How to avoid:** Full pipeline per `docs/runbooks/desktop-build-pipeline.md`: commit → tar-over-ssh to
`droid` → `npm ci` + `expo prebuild --clean` (`CI=1`) + `gradlew.bat assembleRelease` → scp APK back →
`adb -s 1A071FDEE002BU install`. On-device UAT is Pixel-only; this box cannot build.
**Warning signs:** `TurboModuleRegistry`/`requireNativeModule` errors; a "works in dev, missing in
build" report.

### Pitfall 2: No config-plugin entry needed (and adding one breaks the build)
**What goes wrong:** By analogy to `expo-image`/`expo-image-picker`, someone adds `"expo-sms"` to
`app.config.ts` `plugins`. Prebuild then errors (unknown/absent plugin) — or at best it is dead config.
**Why it happens:** Some Expo modules ship config plugins (permissions/native tweaks); these two do not.
**How to avoid:** Leave the `plugins` array unchanged. Autolinking picks the modules up from
`package.json`. `[VERIFIED: neither module's official SDK-57 doc lists a config plugin]`
**Warning signs:** A prebuild plugin-resolution error naming `expo-sms`/`expo-clipboard`.

### Pitfall 3: off_limits leak via the wrong fuel read
**What goes wrong:** Compose uses `listFuelForEditor` (all kinds incl. off_limits) or a new
off_limits-only projection that re-admits `source='ai'` rows.
**Why it happens:** The UI-SPEC phrase "all kinds except off_limits" reads like a new query is needed.
**How to avoid:** Reuse `getRankedFuel`. Its `RANKED_FUEL_EXCLUSIONS` already excludes off_limits + ai +
blank. A parity test guards the predicate against drift.
**Warning signs:** An off_limits row appearing in the compose list; an unconfirmed AI item on compose.

### Pitfall 4: Android hardware Back pops to the profile
**What goes wrong:** The Back *pill* routes Home, but the phone's hardware/gesture Back still pops to
Profile — CMP-02 half-met.
**Why it happens:** native-stack's default Android Back walks the stack; only the software button was
overridden. (`predictiveBackGestureEnabled:false` in app.config.ts means it's a button/stack pop, not a
swipe — still needs overriding.)
**How to avoid:** The `BackHandler` + `useFocusEffect` override in Pattern 4 (return `true` to consume).
**Warning signs:** UAT: pressing the system Back on compose lands on the profile, not the dashboard.

### Pitfall 5: `setTimeout` for "Copied" fires after unmount
**What goes wrong:** Navigating away during the ~2s window calls `setState` on an unmounted screen.
**Why it happens:** The timeout outlives the component.
**How to avoid:** Store the timer id and clear it in the effect cleanup / before re-arming.
**Warning signs:** A React "state update on unmounted component" warning in the Metro/logcat channel.

### Pitfall 6: Empty draft handed to Send/Copy
**What goes wrong:** The draft opens blank (by design). Sending/copying an empty string is a no-op that
looks broken.
**Why it happens:** No default text; user taps Send before typing.
**How to avoid:** Product call for the planner — either allow empty (SMS composer still opens; harmless)
or gate Send/Copy on non-empty draft. The UI-SPEC does not require a gate; recommend allowing empty
(the composer opening with an empty body is acceptable), but surface it as an Open Question.

## Common Operations (Code Examples)

### Read header (with phone) + fuel, self-fetching on focus
```typescript
// Source: verified src/screens/ContactProfileScreen.tsx load() pattern + fuel-read.ts
const load = useCallback(async () => {
  try {
    const exec = getExecutor();
    const [header, fuelRows] = await Promise.all([
      getContactHeader(exec, contactId),   // widened: includes phone
      getRankedFuel(exec, contactId),      // off_limits/ai/blank excluded IN-QUERY
    ]);
    setHeader(header);
    setFuel(fuelRows);
    setSmsAvailable(await SMS.isAvailableAsync());
  } catch (err) {
    Logger.error("compose", "failed to load contact", err);
    Alert.alert("Couldn't load this contact", "Please go back and retry.");
  }
}, [contactId]);
useFocusEffect(useCallback(() => { void load(); }, [load]));
```

### Pure control-state resolver (recommended `compose-logic.ts`)
```typescript
// Source: derived from 09-UI-SPEC "Interaction States" matrix — pure, node-tested
export interface ComposeControls {
  send: "shown" | "hidden";
  copyEmphasis: "primary" | "secondary";
  addNumber: boolean;
  smsUnavailableHelper: boolean;
}
export function resolveComposeControls(
  hasPhone: boolean,
  smsAvailable: boolean,
): ComposeControls {
  if (!hasPhone)          return { send: "hidden", copyEmphasis: "primary",   addNumber: true,  smsUnavailableHelper: false };
  if (!smsAvailable)      return { send: "hidden", copyEmphasis: "primary",   addNumber: false, smsUnavailableHelper: true  };
  return                        { send: "shown",  copyEmphasis: "secondary", addNumber: false, smsUnavailableHelper: false };
}
```

## Runtime State Inventory

Not applicable — this is a **greenfield additive** phase (a new screen, a new route, two new native
modules, one additive DAO-field widening). No rename/refactor/migration; no existing runtime state is
renamed, moved, or re-keyed. No SQLite migration is added (compose is read-only + native handoff; it
writes nothing to the DB).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Linking` `sms:` scheme for SMS | `expo-sms` `sendSMSAsync` + `isAvailableAsync` | Locked this phase | Reliable capability detection + safe body marshalling |
| `BackHandler.removeEventListener` | `addEventListener(...).remove()` (subscription object) | RN 0.65+ (well before 0.86.2) | Use the returned subscription's `.remove()`; the old static remover is gone |

**Deprecated/outdated:**
- `Clipboard` from `@react-native-community/clipboard` / RN-core `Clipboard`: superseded by
  `expo-clipboard` (the Expo-blessed module for this SDK).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Empty-draft Send/Copy is acceptable (composer opens with empty body) rather than gated | Pitfall 6 / Open Questions | Low — a UX nicety; either choice is safe, planner/owner decides |
| A2 | `navigation.reset` to Home is preferred over `popToTop()`/`navigate("Home")` for Back→dashboard | Pattern 4 | Low — all three land on the dashboard for the profile entry; reset is the entry-agnostic-robust choice (Claude's discretion per CONTEXT) |
| A3 | Reusing `getRankedFuel` (which also excludes `source='ai'`) satisfies UI-SPEC "all kinds except off_limits" | Pattern 2 | Low — excluding unconfirmed AI from a transmittable surface is the established invariant (T-07-03); if the owner wants unconfirmed-AI fuel visible on compose, a new projection is needed, but that would contradict the AI-confirmation model |

**All three are low-risk defaults grounded in shipped invariants; none blocks planning.**

## Open Questions

1. **Empty-draft Send/Copy — allow or gate?**
   - What we know: draft opens blank by design; the UI-SPEC does not require a non-empty gate.
   - What's unclear: whether tapping Send/Copy with an empty draft should be a no-op-with-hint or simply
     open the composer with an empty body.
   - Recommendation: allow it (composer opening empty is harmless); optionally disable Send/Copy while
     the draft is empty if the owner prefers. Planner's call (low stakes).

2. **Two filled-accent primaries on the profile ("Message" + "Log contact").**
   - What we know: UI-SPEC flags this as an owner taste note, not a decision.
   - What's unclear: whether one should be demoted to accent-outline for hierarchy.
   - Recommendation: ship both as filled-accent per the SPEC; do NOT restyle "Log contact" without owner
     direction (reversing shipped styling is an owner call).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm registry (`npx expo install`) | Installing expo-sms / expo-clipboard | ✓ (build host + this box) | expo-sms 57.0.1, expo-clipboard 57.0.1 | — |
| `droid` desktop build host | `expo prebuild --clean` + release APK | ✓ (Tailscale/SSH; runbook proven FND-01) | JDK 17 + Android SDK | none — this Linux box cannot build APKs |
| Pixel 6 Pro (`1A071FDEE002BU`) | On-device UAT of Send (SMS composer) + Copy | ✓ (wired USB; owner present) | Android | none — SMS composer + telephony only assessable on a real phone |
| Vitest (node) | `-logic.ts` unit tests | ✓ | `^4.1.10` | — |

**Missing dependencies with no fallback:** none (all present via the proven pipeline).
**Missing dependencies with fallback:** none.

> Note: `SMS.isAvailableAsync()` returns `false` in the iOS simulator/browser and only reflects real
> telephony on a device — Send's happy path is **Pixel-only** UAT. There is no local emulator on this
> box (Ivy Bridge CPU, documented in CLAUDE.md).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.10` (node environment) |
| Config file | none dedicated — `vitest run` picks up `*.test.ts` (repo convention) |
| Quick run command | `npm test` |
| Full suite command | `npm test` (666/666 green at Phase 8 close) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMP-01 | off_limits never reaches the compose fuel list (in-query) | unit (reuse) | `npm test` (`fuel-read.test.ts` already asserts `getRankedFuel` exclusions) | ✅ existing |
| CMP-01 | draft edit + Send/Copy hand-off | device-UAT | Pixel UAT (native SMS/clipboard) | ❌ manual (Pixel) |
| CMP-02 | Back → dashboard (software + hardware) | device-UAT | Pixel UAT via `uiautomator` | ❌ manual (Pixel) |
| CMP-02 | `Compose` route typed + reachable | typecheck | `npx tsc --noEmit` | ✅ (tsc) |
| CMP-03 | control-state matrix (no-phone / no-SMS / both) | unit | `npm test` (`compose-logic.test.ts`) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` + `npx tsc --noEmit` + `npm run check:colors`
- **Per wave merge:** `npm test` (full)
- **Phase gate:** full suite green + Pixel UAT (Send opens SMS composer pre-filled; Copy → "Copied";
  Back → dashboard on both button and hardware Back; no-phone → Copy works + add-number affordance).

### Wave 0 Gaps
- [ ] `src/logic/compose-logic.test.ts` — covers CMP-03 control-state matrix (the pure resolver)
- [ ] (No new fixtures needed — `getRankedFuel` exclusion parity is already tested in `fuel-read.test.ts`)
- [ ] Framework install: none — Vitest already present.

*The `.tsx` screen (render, native SMS/clipboard, navigation, hardware Back) is device-UAT — it cannot
load under node, per the repo's `-logic.ts` split convention.*

## Security Domain

`security_enforcement` is enabled (ASVS L1). This phase touches a **transmittable surface** (draft →
SMS/clipboard) and private data (fuel), so the access-control invariant is load-bearing.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local-only app; no auth surface |
| V3 Session Management | no | No sessions |
| V4 Access Control | **yes** | off_limits (and unconfirmed AI) excluded **in-query** by `getRankedFuel` — never a UI filter (HANDOFF §14 / FUEL-02 / T-07-02) |
| V5 Input Validation | minimal | Draft is the user's own text handed to a native composer/clipboard — native marshalling, no URL/SQL surface; no untrusted input parsed |
| V6 Cryptography | no | No crypto in this phase |
| V7 Least privilege | **yes** | No `SEND_SMS` permission; no config-plugin permissions; no network on any read path |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| off_limits fuel leaking to a transmittable surface | Information disclosure | Reuse `getRankedFuel`; NEVER `listFuelForEditor`; exclusion is structural (SQL), test-guarded |
| Unconfirmed AI fuel presented as fact / into transmit | Information disclosure / Tampering | `getRankedFuel`'s `source != 'ai'` predicate keeps unconfirmed proposals off compose until confirmed |
| Body-content corruption via URL encoding | Tampering | `expo-sms` native address+body marshalling (the reason Linking was rejected) |
| Silent send / background transmission | Repudiation / EoP | `sendSMSAsync` opens the user-visible composer; nothing sends without the user tapping send in the SMS app; no permission to send silently |
| Writing a spurious "contacted" log from Send | Tampering (data integrity) | Compose writes NO interaction row — logging stays an explicit, separate profile action |

## Sources

### Primary (HIGH confidence)
- `docs.expo.dev/versions/latest/sdk/sms/` (SDK 57) — `isAvailableAsync` `Promise<boolean>`;
  `sendSMSAsync(addresses, message, options)` → `Promise<SMSResponse>`; Android always `{ result:
  'unknown' }`; no SEND_SMS mentioned; no config plugin listed. `[CITED]`
- `docs.expo.dev/versions/latest/sdk/clipboard/` (SDK 57) — `setStringAsync(text, options)` →
  `Promise<boolean>` (always `true` on Android); no Android permission; no config plugin listed. `[CITED]`
- npm registry via `npm view` — expo-sms 57.0.1, expo-clipboard 57.0.1, `sdk-57`/`latest`/`next` line,
  no postinstall. `[VERIFIED: npm registry]`
- Source on disk (verified this session): `src/db/fuel-read.ts` (getRankedFuel + RANKED_FUEL_EXCLUSIONS,
  lines 133–154), `src/db/contact-read.ts` (getContactHeader 65–103, getContactForEdit 156–183),
  `src/navigation/types.ts` (20–56), `src/navigation/RootNavigator.tsx` (49–73),
  `src/screens/ContactProfileScreen.tsx` (load 159–191, popToTop 246, log-contact button 586–609),
  `src/services/fuel-age.ts` (formatFuelAge 92), `src/components/FuelEditor.tsx` (KIND_OPTIONS 72–78),
  `app.config.ts` (plugins 54–77, predictiveBackGestureEnabled:false 26), `package.json` (deps). `[VERIFIED]`
- `09-UI-SPEC.md` (approved) — layout, copywriting, interaction-state matrix, token map. `[VERIFIED]`
- `09-CONTEXT.md` (locked decisions). `[VERIFIED]`
- `HANDOFF.md` §6 (friction / SMS composer + fuel visible), §14 (custom-fields/off_limits invariants);
  `docs/dossier/INDEX.md` compose cross-domain entries (compose is one surface, built once; fuel visible
  only on compose; SMS reads `contacts.phone`; Copy is the guaranteed handoff). `[VERIFIED]`
- `docs/runbooks/desktop-build-pipeline.md` — prebuild + APK pipeline. `[VERIFIED]`

### Secondary (MEDIUM confidence)
- `BackHandler.addEventListener(...).remove()` subscription API — RN 0.65+ convention (RN 0.86.2 in
  `package.json`). `[ASSUMED — standard RN, not re-verified against 0.86.2 changelog this session]`

### Tertiary (LOW confidence)
- none.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both deps verified against official SDK-57 docs + npm registry; versions pinned.
- Architecture: HIGH — every reused symbol read on disk; additive patterns match shipped code (08-06,
  NeverContacted/ManageFavourites).
- Pitfalls: HIGH — prebuild/plugin/off_limits/hardware-Back pitfalls grounded in verified source and
  docs.
- Security: HIGH — access-control invariant is enforced by the reused in-query exclusion.

**Research date:** 2026-08-16
**Valid until:** 2026-09-15 (stable; re-verify expo-sms/expo-clipboard versions if the SDK bumps).
