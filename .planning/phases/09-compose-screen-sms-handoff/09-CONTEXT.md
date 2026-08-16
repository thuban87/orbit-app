# Phase 9: Compose Screen & SMS Handoff - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

The in-app **compose screen** — the single "fuel visible → send" surface, reachable from a
contact's profile — delivering CMP-01/02/03:

- Shows the contact's **full fuel** (read-only, `off_limits` excluded) and an **editable message
  draft**.
- **Send** hands off to the SMS composer; **Copy** always works (Copy is the guaranteed handoff,
  Send is best-effort).
- **Back → dashboard** (not a pop back to the profile), regardless of entry point.
- Degrades gracefully when the contact has **no phone number**: Copy still works and an
  "add number" affordance appears.

It is a **cross-phase-shared surface, built once** (ROADMAP: "The compose screen is one surface,
built once") and later reused by notifications (Phase 11), the widget Message action (Phase 12),
and AI Suggest (Phase 14). It is designed **entry-agnostic** here — minimal serializable params
(`contactId`), self-fetching, no callbacks — so those later consumers can open it with just a
contact id. This phase wires only the **profile** entry point.

</domain>

<decisions>
## Implementation Decisions

### SMS + Copy handoff mechanics
- **Send uses `expo-sms`** (`sendSMSAsync`) — a new first-party native module. Chosen over the
  RN-core `Linking` `sms:` scheme on the merits (not effort): it gives correct
  `isAvailableAsync()` capability detection (avoiding the Android-11 `canOpenURL`
  package-visibility trap) and native address+body marshalling (no URL-encoding corruption on a
  draft containing `&`, `#`, newlines, or emoji). Prefill reliability is **identical** between the
  two paths — both fire the same Android `ACTION_SENDTO` intent and open the default SMS app
  pre-filled; neither sends silently; **neither needs the `SEND_SMS` permission**.
- **Copy uses `expo-clipboard`** (`setStringAsync`) — a new native module. Copy is the guaranteed
  handoff; Send is best-effort (the SMS app may or may not honor the pre-filled body).
- Both are native modules ⇒ this phase requires a full **`expo prebuild --clean` + release build**
  for on-device UAT (not a JS-only Metro reload).
- Phone number sourced from `contacts.phone`. **No phone ⇒** Send is hidden/disabled, Copy still
  works, and an "add number" affordance routes to EditContact (CMP-03).

### Message draft
- The draft opens **blank** (empty editable multiline field). The user types; Phase 14's AI Suggest
  fills it later. No greeting template, no cross-session persistence.

### Fuel display
- **Full fuel, read-only** — all fuel kinds **except `off_limits`**, shown as a read-only reference
  while composing (matches CMP-01's "full fuel"). Editing fuel stays on the profile's `FuelEditor`.
  `off_limits` is excluded **in-query** (the never-transmitted invariant, HANDOFF §14 / REQUIREMENTS).

### Navigation & reuse
- New **`Compose` route registered additively** in `RootStackParamList`, **serializable params only**
  (`{ contactId }`), self-fetching — so notification(11)/widget(12)/AI(14) can navigate with just a
  contact id (pattern established by the additive NeverContacted / ManageFavourites routes).
- **Back → dashboard** (CMP-02) — implemented as navigation to Home, not a stack pop to the profile.
- Entry from profile: a primary **"Message"** button on `ContactProfileScreen`.

### Claude's Discretion
- Exact layout/spacing; whether to reuse an existing fuel renderer vs a compose-specific read-only
  one; draft `TextInput` sizing; the precise mechanism for "Back → dashboard" (navigation reset vs
  `navigate("Home")`); the "add number" affordance styling; whether Send is hidden vs
  disabled-with-hint when no phone; extraction of any number-formatting / draft logic into a
  node-tested `-logic.ts` module. All colours via theme tokens.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/screens/ContactProfileScreen.tsx` — the entry point; add the "Message" action here.
- `src/db/fuel-read.ts` — `listFuelForEditor`, `getRankedFuel`, `escapeLike`. `getRankedFuel`
  already excludes `off_limits` (and `source='ai'`) **in-query**; the compose full-fuel read should
  reuse/extend that exclusion rather than re-derive it. May need a new "full fuel minus off_limits"
  projection.
- `src/components/FuelEditor.tsx` and the `RankedFuelLine` component — existing fuel rendering to
  mirror for the read-only compose display.
- `src/components/Avatar.tsx` — contact header avatar (contactId + cacheBust pattern).
- `src/navigation/types.ts` (`RootStackParamList`, line 20) + `src/navigation/RootNavigator.tsx` —
  additive route registration point.
- `Linking` + `normaliseLinkUrl` (used in `FuelEditor`/`LinksEditor`) — the existing hand-rolled
  URI-safety pattern (context for why native marshalling via expo-sms is preferable for the body).
- `contacts.phone` — the phone source; read via `getContactHeader` / `getContactForEdit`.
- `src/theme` `useTheme().colors.*` — all colours resolve here.

### Established Patterns
- Screens own their own Back chrome (`headerShown:false`, since 04-01).
- Correctness-critical logic extracted into pure, node-tested `-logic.ts` modules; `.tsx` screens are
  device-UAT.
- Serializable-only route params; additive route registration (NeverContacted, ManageFavourites).
- New native deps installed via `npx expo install`; config plugins registered in `app.config.ts`;
  native changes require a full `expo prebuild --clean` + rebuild.
- Reads are async-only, offline — **no network on any read path**.

### Integration Points
- `ContactProfileScreen` → `navigate("Compose", { contactId })`.
- `RootNavigator` + `types.ts` → register the `Compose` route.
- `fuel-read.ts` → compose fuel read (off_limits excluded).
- `app.config.ts` → `expo-sms` / `expo-clipboard` plugin/config if required.
- Cross-phase (later): 11/12/14 navigate to `Compose` with a contactId; 14 adds "AI Suggest" here.

</code_context>

<specifics>
## Specific Ideas

- Acceptance is CMP-01 (full fuel + editable draft; Send → SMS composer; Copy always works),
  CMP-02 (reachable from profile now, later from notification/widget/AI; Back → dashboard),
  CMP-03 (no phone ⇒ Copy works + "add number" affordance).
- `expo-sms` + `expo-clipboard` chosen with explicit reasoning: prefill reliability is identical to
  the Linking path, so the decision turned on correct capability detection + safe body encoding,
  with the prebuild cost already sunk for clipboard.

</specifics>

<deferred>
## Deferred Ideas

- **AI Suggest on compose** — Phase 14 (this screen is the host; design the layout to leave room).
- **Notification / widget entry points into compose** — Phases 11/12 (screen is built entry-agnostic
  now, wired later).
- **SMS send-confirmation tracking** — not pursued (Android's composer returns `unknown`; the app
  can't know whether a text was actually sent — this is why Copy is the guaranteed handoff).

</deferred>
