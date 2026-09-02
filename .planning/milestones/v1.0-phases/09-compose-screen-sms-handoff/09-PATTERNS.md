# Phase 9: Compose Screen & SMS Handoff - Pattern Map

**Mapped:** 2026-08-16
**Files analyzed:** 7 (2 new, 1 new-recommended, 4 edits)
**Analogs found:** 7 / 7 (every net-new/edited file has a shipped analog read on disk)

> All analogs below were read from the **actual code on disk** (CLAUDE.md "Review the
> code, not the diff"), not from RESEARCH.md's line-number claims. Where a claim was
> verified against source it is noted inline.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/screens/ComposeScreen.tsx` | screen | request-response (self-fetch on focus) + device-handoff | `src/screens/ContactProfileScreen.tsx` (+ `ArchivedContactsScreen.tsx` for Back chrome) | role-match (read+Back chrome; native handoff is net-new) |
| `src/logic/compose-logic.ts` | logic (pure) | transform (inputs → control state) | `src/logic/dashboard-empty-logic.ts` | exact (pure discriminated resolver + `.test.ts`) |
| `src/logic/compose-logic.test.ts` | test | transform | `src/logic/dashboard-empty-logic.test.ts` | exact |
| `src/db/contact-read.ts` (`getContactHeader`) | model/DAO read | request-response | itself — the 08-06 `favourite_rank` additive widening | exact (same function, same widening idiom) |
| `src/db/fuel-read.ts` (`getRankedFuel`) | model/DAO read | CRUD-read | **reuse unchanged** — no edit | reuse |
| `src/navigation/types.ts` + `RootNavigator.tsx` | config/route | — | `NeverContacted` / `ManageFavourites` additive registration | exact |
| `src/screens/ContactProfileScreen.tsx` ("Message" button) | screen (small edit) | request-response | its own "Log contact" `Pressable` (lines 586-609) | exact |

## Pattern Assignments

### `src/screens/ComposeScreen.tsx` (screen — new)

**Primary analog:** `src/screens/ContactProfileScreen.tsx`. Back-chrome/style analog: `src/screens/ArchivedContactsScreen.tsx`.

**Self-fetch-on-focus pattern** (verified `ContactProfileScreen.tsx:159-203`) — copy this `load()` + `useFocusEffect` shape, trimmed to header + fuel + SMS capability:
```typescript
const load = useCallback(async () => {
  try {
    const exec = getExecutor();
    const [header, fuelRows] = await Promise.all([
      getContactHeader(exec, contactId),   // widened: includes phone (below)
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
Note: the profile's real `load()` (lines 162-170) fetches six things via `Promise.all`; compose needs only two — do **not** copy the timeline/status/gravity/intensity reads.

**Screen scaffold + Back pill** (verified `ContactProfileScreen.tsx:481-496`; identical idiom in `ArchivedContactsScreen.tsx:155-159`):
```typescript
<ScrollView
  testID="compose-screen"
  style={{ backgroundColor: colors.background }}
  contentContainerStyle={styles.content}   // { padding: 16, gap: 16 }
>
  <View style={styles.header}>            // { flexDirection: row, alignItems: center, gap: 12 }
    <Pressable
      testID="compose-back"
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={goHome}                      // NOT goBack() — see Back→dashboard below
      style={[styles.backBtn, { borderColor: colors.border }]}
    >
      <Text style={{ color: colors.textSecondary }}>Back</Text>
    </Pressable>
    <Avatar photo={header?.photo ?? null} name={header?.name ?? ""}
            contactId={contactId} cacheBust={header?.modified_at} size={64} />
    <Text testID="compose-name" accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}>
      {header?.name ?? ""}
    </Text>
  </View>
```
**Back pill style** (verified `ArchivedContactsScreen.tsx:243-247` — `paddingHorizontal:14, paddingVertical:8`, `borderWidth:1`, radius 8; the 14px shipped exception in UI-SPEC).

**Section heading style** (verified `ContactProfileScreen.tsx:813-818`) — reuse verbatim for "CONVERSATIONAL FUEL" / "YOUR MESSAGE":
```typescript
sectionHeading: {
  fontSize: 13, fontWeight: "700",
  textTransform: "uppercase", letterSpacing: 0.5,
},
```

**Back → dashboard (software + hardware)** — this screen's ONE genuinely new nav behavior. The profile uses `navigation.popToTop()` (verified `ContactProfileScreen.tsx:246`), but RESEARCH Pattern 4 prescribes `navigation.reset` for entry-agnostic robustness (future notification/widget callers where Home is not in the stack):
```typescript
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

const goHome = useCallback(() => {
  navigation.reset({ index: 0, routes: [{ name: "Home" }] });
}, [navigation]);

useFocusEffect(useCallback(() => {
  const sub = BackHandler.addEventListener("hardwareBackPress", () => {
    goHome();
    return true; // consume — prevents native-stack's default pop to Profile
  });
  return () => sub.remove();
}, [goHome]));
```

**Read-only fuel card** — mirror `FuelEditor` row chrome (`surface` bg, `border`, radius 10, padding 12, gap 10) with static `Text`, no `TextInput`. Kind→label strings are fixed in `FuelEditor.KIND_OPTIONS` (verified `FuelEditor.tsx:72-78`): `recent→"Recent"`, `topic→"Topic"`, `fact→"Fact"`, `gift→"Gift idea"` (`off_limits→"Off-limits"` never appears — excluded in-query). Age via `formatFuelAge(row.created_at, localDateTime())` (verified signature `fuel-age.ts:92` — `(createdAt: string, now: string) => string`).

**Send / Copy native calls** (RESEARCH Pattern 5; docs-sourced, no on-disk analog — this is the net-new surface):
```typescript
import * as SMS from "expo-sms";
import * as Clipboard from "expo-clipboard";
// Send (phone present && smsAvailable):
try { await SMS.sendSMSAsync(phone, draft); }          // Android → { result: 'unknown' }
catch { Alert.alert("Couldn't open your messages app", "Your message is ready to copy instead."); }
// Copy (always):
try { await Clipboard.setStringAsync(draft); /* "Copied" 2s via setState+setTimeout */ }
catch { Alert.alert("Couldn't copy", "Please try again."); }
```
Anti-patterns (RESEARCH): never write an interaction/log row from Send/Copy; never render "Message sent!"; never `.filter()` off_limits in the component; clear the "Copied" `setTimeout` on unmount (Pitfall 5).

---

### `src/logic/compose-logic.ts` (logic — new, recommended)

**Analog:** `src/logic/dashboard-empty-logic.ts` (verified read in full). Copy its shape exactly:
- No UI-framework imports (pure, node-testable) — verified `dashboard-empty-logic.ts` imports only a type from `@/db/dashboard-read`.
- A documented **explicit precedence** header comment (the dashboard module's `(1)…(4)` block) — compose's is a 3-branch matrix.
- An exported `interface` input/output + one pure `resolve*` function; "same inputs → same output; no I/O; never throws".

**Core resolver** (from RESEARCH; matrix derived from UI-SPEC "Interaction States"):
```typescript
export interface ComposeControls {
  send: "shown" | "hidden";
  copyEmphasis: "primary" | "secondary";
  addNumber: boolean;
  smsUnavailableHelper: boolean;
}
export function resolveComposeControls(hasPhone: boolean, smsAvailable: boolean): ComposeControls {
  if (!hasPhone)     return { send: "hidden", copyEmphasis: "primary",   addNumber: true,  smsUnavailableHelper: false };
  if (!smsAvailable) return { send: "hidden", copyEmphasis: "primary",   addNumber: false, smsUnavailableHelper: true  };
  return               { send: "shown",  copyEmphasis: "secondary", addNumber: false, smsUnavailableHelper: false };
}
```

**Test analog:** `src/logic/dashboard-empty-logic.test.ts` (verified 1-40). Copy its structure: `import { describe, expect, it } from "vitest"`; a `describe("resolveComposeControls — …")` with one `it` per matrix row (3 rows → CMP-03 coverage). This is the only Wave-0 test gap.

---

### `src/db/contact-read.ts` — widen `getContactHeader` for `phone` (edit, additive)

**Analog:** itself — the 08-06 `favourite_rank` additive widening, still visible in-source. Verified `contact-read.ts:65-103`: current SELECT is
```sql
SELECT id, name, rarely_responds, archived_at, photo, modified_at, favourite_rank FROM contacts WHERE id = ?
```
Add `phone` to both the SELECT column list and the `Promise<{…}>` return-type literal (two places — the outer signature at 68-90 and the inner `getFirstAsync<{…}>` at 91-99), typed `phone: string | null`. The doc-comment at 85-89 records exactly why this is safe: the two other callers read the result **field-wise** — `ContactProfileScreen` destructures a local `Header` type (verified `ContactProfileScreen.tsx:100-112`, no `phone` today), `EditContactScreen`'s photo refresh reads only `photo`/`modified_at`, and `contact-read.test.ts` asserts fields individually — so an additive field breaks neither typecheck nor tests. Mirror that comment for `phone`.

Do **not** use `getContactForEdit` (verified 156-183) — it joins categories + loads all custom values + links; overkill for a header.

---

### `src/db/fuel-read.ts` — `getRankedFuel` (REUSE, no edit)

Call `getRankedFuel(exec, contactId)` and render **every** returned row (the profile uses only `rankedFuel[0]`; compose renders all of them). Do **NOT** call `listFuelForEditor` — it is the ONE read that surfaces `off_limits` (verified `fuel-read.ts:19-24, 50-66`). The exclusion is structural/in-query via `RANKED_FUEL_EXCLUSIONS` (verified `fuel-read.ts:133-135`): `kind != 'off_limits' AND source != 'ai' AND` non-blank text — off_limits (never-transmitted, HANDOFF §14/FUEL-02) + unconfirmed AI (T-07-03) + blank all excluded. A parity test in `fuel-read.test.ts` already guards CMP-01's in-query exclusion — no new fixture needed.

---

### `src/navigation/types.ts` + `RootNavigator.tsx` — register `Compose` (edit, additive)

**Analog:** `NeverContacted` / `ManageFavourites` (verified `types.ts:47-55`, `RootNavigator.tsx:63-70`). Append, leaving `initialRouteName:"Home"` and existing routes untouched:
```typescript
// types.ts — after ManageFavourites (verified :55)
Compose: { contactId: number };   // serializable param ONLY — no callbacks (11/12/14 open with just an id)
```
```typescript
// RootNavigator.tsx — import ComposeScreen (:2-11 import block), then a <Stack.Screen> (:55-70 idiom)
<Stack.Screen name="Compose" component={ComposeScreen} />
```
`headerShown:false` is set globally on `screenOptions` (verified `RootNavigator.tsx:53`) — Compose owns its own Back chrome automatically.

---

### `src/screens/ContactProfileScreen.tsx` — "Message" button (edit)

**Analog:** the sibling "Log contact" `Pressable` directly below where "Message" goes (verified `ContactProfileScreen.tsx:586-609`, styles `:792-803`). Render "Message" **directly above** "Log contact" as a filled-accent primary, reusing the `logContact`/`logContactText` style shape (or a shared style):
```typescript
<Pressable
  testID="contact-profile-message"
  accessibilityRole="button"
  accessibilityLabel={`Message ${header?.name ?? ""}`}
  onPress={() => navigation.navigate("Compose", { contactId })}
  style={[styles.logContact, { backgroundColor: colors.accent, borderColor: colors.accent }]}
>
  <Text style={[styles.logContactText, { color: colors.background }]}>Message</Text>
</Pressable>
```
`logContact` = `{ minHeight:44, borderWidth:1, borderRadius:8, padding:12, alignItems:center, justifyContent:center }`; `logContactText` = `{ fontSize:16, fontWeight:"700" }` (verified). UI-SPEC flags "two filled-accent primaries" as an owner taste note — ship both as filled-accent; do NOT restyle "Log contact".

## Shared Patterns

### Access control — off_limits/AI never on a transmittable surface (V4, load-bearing)
**Source:** `src/db/fuel-read.ts:133-135` (`RANKED_FUEL_EXCLUSIONS`).
**Apply to:** `ComposeScreen` fuel read. Reuse `getRankedFuel`; never `listFuelForEditor`; never a component `.filter()`. The invariant lives in SQL (HANDOFF §14 / T-07-02).

### Self-fetch on focus + Alert-on-load-error
**Source:** `src/screens/ContactProfileScreen.tsx:159-203`.
**Apply to:** `ComposeScreen`. `useFocusEffect(useCallback(() => void load(), [load]))`; on catch, `Logger.error` + `Alert.alert("Couldn't load this contact", "Please go back and retry.")`.

### Back-chrome + section-heading + primary-button styles (theme tokens only)
**Source:** `ContactProfileScreen.tsx` (`backBtn`/`sectionHeading`/`logContact` styles) + `ArchivedContactsScreen.tsx:234-247` (`content`/`header`/`backBtn`).
**Apply to:** `ComposeScreen`. Every colour via `useTheme().colors.*` — zero hex literals (`check:colors`-gated). Touch targets `minHeight:44`.

### Pure `-logic.ts` + node test split
**Source:** `src/logic/dashboard-empty-logic.ts` + `.test.ts`.
**Apply to:** `compose-logic.ts` — correctness-critical branch matrix is node-tested; the `.tsx` render/native/nav is Pixel device-UAT.

### Additive route registration (serializable params, no callbacks)
**Source:** `types.ts` / `RootNavigator.tsx` `NeverContacted`/`ManageFavourites`.
**Apply to:** the `Compose` route.

## No Analog Found

| Concern | Role | Data Flow | Reason |
|---------|------|-----------|--------|
| `SMS.sendSMSAsync` / `SMS.isAvailableAsync` | device native module | device-handoff | First use of `expo-sms` in the repo — no on-disk analog; follow RESEARCH Pattern 5 + SDK-57 docs |
| `Clipboard.setStringAsync` | device native module | device-handoff | First use of `expo-clipboard` — no analog; RESEARCH Pattern 5 |
| Android `BackHandler` hardware-Back override | screen lifecycle | event-driven | No shipped screen overrides hardware Back (others rely on native-stack default pop); RESEARCH Pattern 4 |
| Transient "Copied" confirm (`setState`+`setTimeout`) | UI feedback | event-driven | No shipped transient-toast idiom; UI-SPEC "Copy feedback" (NOT a per-frame animation, CLAUDE.md) |

These four are the phase's genuinely net-new code; the planner should reference RESEARCH.md Patterns 4-5 and the UI-SPEC interaction matrix rather than a codebase analog.

## Metadata

**Analog search scope:** `src/screens/`, `src/logic/`, `src/db/`, `src/navigation/`, `src/components/`, `src/services/`
**Files read on disk:** `fuel-read.ts`, `contact-read.ts`, `navigation/types.ts`, `RootNavigator.tsx`, `ContactProfileScreen.tsx` (targeted ranges), `dashboard-empty-logic.ts` + `.test.ts`, `FuelEditor.tsx` (KIND_OPTIONS), `fuel-age.ts` (formatFuelAge), `ArchivedContactsScreen.tsx` (Back chrome/styles)
**Pattern extraction date:** 2026-08-16
