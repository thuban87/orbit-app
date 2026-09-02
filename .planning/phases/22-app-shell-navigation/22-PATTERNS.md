# Phase 22: App Shell & Navigation - Pattern Map

**Mapped:** 2026-09-02
**Files analyzed:** 11 new/modified (3 new components, 3 new nav modules, 1 nav rewrite, 1 types split, 3 external-reset call-site updates + screen edits)
**Analogs found:** 11 / 11 (all have a real on-disk analog; none require inventing a pattern from RESEARCH.md alone)

> Read-only mapping. Every excerpt below was read on disk this session and is quoted with file:line. This is a **pure navigation refactor — NO SQLite migration (D-03)**. Confirm nothing here reverses ADR-044 / ADR-018 / ADR-080 (D-04/D-07).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/navigation/RootNavigator.tsx` (rewrite → bottom-tabs) | navigation (root) | event-driven (nav) | itself, current flat stack (`RootNavigator.tsx:71-120`) | exact (same file, role change) |
| `src/navigation/tabs/{Dashboard,Orrery,Backup,Settings}Stack.tsx` (new) | navigation (per-tab stack) | event-driven (nav) | current `createNativeStackNavigator` block (`RootNavigator.tsx:57,73-118`) | exact |
| `src/navigation/types.ts` (split flat → tab + per-stack param lists) | config/types | — | current `RootStackParamList` (`types.ts:22-30+`) + placeholder-route doc (`types.ts:11-18`) | exact |
| `src/navigation/reset-intents.ts` (new, pure) | utility (pure resolver) | transform (returns serializable intent) | `add-speed-dial-fab-logic.ts` (pure, node-testable helper) | role-match (pure-intent idiom) |
| `src/navigation/back-intent.ts` (new, pure) | utility (pure resolver) | transform | `add-speed-dial-fab-logic.ts:23-25` | role-match |
| `src/logic/contact-picker-order.ts` (new, pure) | utility (ordering) | transform | `capture-read.ts:52-73` (`listCapturePickContacts`) | exact (favourites→recency→alpha already exists) |
| `src/components/UniversalFab.tsx` (new; supersedes `AddSpeedDialFab`) | component | event-driven (UI) | `AddSpeedDialFab.tsx:22-129` | exact |
| `src/components/universal-fab-logic.ts` (new, pure) | utility (action set/order/context map) | transform | `add-speed-dial-fab-logic.ts` | exact |
| `src/components/ContactPicker.tsx` (new) | component | request-response (modal + list read) | `LegacyContactPickerScreen.tsx:48-265` (Modal-less FlatList) + `OverflowMenu.tsx:29-60` (Modal sheet) | role-match (compose two analogs) |
| `src/components/Snackbar.tsx` (new) | component | event-driven (transient overlay) | `CaptureScreen.tsx:851-862` (`capture-confirmation-toast`) | partial (closest transient-confirmation surface; no true snackbar exists) |
| `src/navigation/widget-linking.ts` + `notification-gate.tsx` + `ComposeScreen/ImportComplete/ReconcileComplete/RestorePreview/RestoreResult` (reset shape edits) | navigation (call sites) | event-driven | current reset calls (inventory below) | exact |

---

## Pattern Assignments

### `src/navigation/RootNavigator.tsx` → `createBottomTabNavigator` (navigation root)

**Analog:** current flat stack in the same file (`RootNavigator.tsx:57-120`).

**Generic-typed navigator factory + `headerShown:false` screenOptions** (`RootNavigator.tsx:57,71-76`) — keep this exact shape; screens own their chrome (do not add a tab-bar header):
```tsx
const Stack = createNativeStackNavigator<RootStackParamList>();
// ...
<Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
```
Post-refactor: `const Tab = createBottomTabNavigator<TabParamList>();` with `screenOptions={{ headerShown:false, tabBarHideOnKeyboard:true, animation:"fade" }}` (SHELL-06/15 — VERIFY `animation` token against installed v7 minor, Assumption A1). Four `<Tab.Screen>` each `component={XStack}`.

**Thin route-wrapper idiom** (`RootNavigator.tsx:65-69`) — the codebase already wraps a prop-driven screen so the navigator supplies `goBack`; reuse when a screen needs an injected back action rather than `useNavigation`:
```tsx
function CustomFieldsRoute({ navigation }: RootStackScreenProps<"CustomFields">) {
  return <CustomFieldsScreen onBack={() => navigation.goBack()} />;
}
```

**Route→tab assignment (Claude's discretion, Assumption A2):** move `Home,Profile,Edit,Compose,Create,Digest,Capture,NeverContacted,UnboundContacts,CropPhoto,ManageFavourites` → DashboardStack; `Orrery` → OrreryStack; `Backup,BackupSettings,RestorePreview,RestoreResult` + all import/reconcile routes (`ImportReview…ReconcileComplete`, `RootNavigator.tsx:99-117`) → BackupStack; `Settings,CustomFields,Archived` → SettingsStack. **`Archived` gets ONE component instance** — register in one owning stack, `navigate` from the other entry (Pitfall 6, ADR-018 single destructive surface).

---

### `src/navigation/types.ts` — split flat param list (config/types)

**Analog:** `types.ts:22-30` (`RootStackParamList`) + the **placeholder-route doc pattern** at `types.ts:11-18` (already the codebase's documented answer to "route exists before its screen does" — the exact mechanism the 4 not-yet-built FAB actions use, per Open Q1/A6):
```ts
// types.ts:13-16 (verbatim) — the placeholder contract Phase 22 reuses for
// Group Log / Log Contact / Update Contact / Memory / Group Events routes:
// "Routes whose screens land in later plans (...) register themed placeholders
//  until those plans replace them, so every route is type-checked and reachable now."
```
**Type-alias-not-interface constraint** (`types.ts:19-21`): the split `TabParamList` and each per-stack list must stay `type` aliases (implicit index signature satisfies `ParamListBase`; an `interface` fails TS2344). Add `NavigatorScreenParams<...>` for each tab value and `CompositeScreenProps` helpers (RESEARCH §"Composite screen props", lines 375-397). Every `RootStackScreenProps<...>` consumer must move to the correct per-tab helper — the largest mechanical change.

---

### `src/logic/contact-picker-order.ts` (new, pure) + `ContactPicker.tsx` ordering (SHELL-10)

**Analog:** `capture-read.ts:52-73` — `listCapturePickContacts` **already implements favourites → recency → alpha** as a static SQL ORDER BY, and its ordering is unit-tested (`capture-read.test.ts:76-134`). This is the closest existing read; the picker's "Favourites → recent → alphabetical" is the same shape (recency source differs: picker wants interaction recency, not `fuel.created_at`):
```sql
-- capture-read.ts:66-72 (verbatim) — the exact ordering idiom to copy:
      WHERE c.archived_at IS NULL
      ORDER BY (c.favourite_rank IS NULL),
               c.favourite_rank ASC,
               (m.last_captured IS NULL),
               m.last_captured DESC,
               c.name COLLATE NOCASE ASC
```
Copy the read posture verbatim (`capture-read.ts:1-28`): single async `getAllAsync`, **no transaction, no mutex, no migration, static string (no interpolation)**, `WHERE archived_at IS NULL` only. SHELL-10 nuance: archived surfaces **via search only** and snoozed rows are **selectable but marked** — express these as pure filter/label logic in `contact-picker-order.ts` so it is node-testable (mirror `capture-read.test.ts`). Name it distinctly from the existing import-flow `contact-picker-*` logic (Wave-0 note, RESEARCH line 490).

---

### `src/components/UniversalFab.tsx` (new; supersedes `AddSpeedDialFab`) — SHELL-08/09

**Analog:** `AddSpeedDialFab.tsx:22-129` (2-action → 6-action). Keep every Reanimated + scrim pattern; only the action count/labels/context routing change.

**Reanimated open/close — shared value mirrored to state ONLY for pointerEvents** (`AddSpeedDialFab.tsx:27-36`) — this is the CLAUDE.md "never animate from React state" compliance; preserve it:
```tsx
const [open, setOpen] = useState(false);
const expanded = useSharedValue(0);
const setExpanded = (next: boolean) => {
  expanded.value = withTiming(next ? 1 : 0, { duration: 180 });
  setOpen(next);
};
const scrimPointerEvents = speedDialScrimPointerEvents(open);
```

**Scrim pointer-events helper — REUSE, do not reinvent** (`add-speed-dial-fab-logic.ts:23-25`, tested):
```ts
export function speedDialScrimPointerEvents(open: boolean): ScrimPointerEvents {
  return open ? "auto" : "none";
}
```
The `absoluteFill` scrim + collapsed options must carry `pointerEvents={scrimPointerEvents}` (`AddSpeedDialFab.tsx:72-81`) — Pitfall 3, opacity-0 views still capture touches.

**Theme tokens on every colour** (`AddSpeedDialFab.tsx:23,86-91,119,122`): `useTheme().colors.{surfaceElevated,border,textPrimary,accent,background}` — no literals (CLAUDE.md). **44px touch targets** already present (`styles.option.minHeight:44`, `styles.base` 56×56).

**New:** put the six-action set + fixed order + context→target mapping in `universal-fab-logic.ts` (pure, node-testable) mirroring `add-speed-dial-fab-logic.ts`. Order (D-05, fixed): Add Contact → `Create`; Quick Log → shell write (below); Log Contact → placeholder; Group Log (pos 4) → placeholder, **no pre-picker**; Update Contact → placeholder; Memory → placeholder. Migrate the `dashboard-create-fab` testID + callers (RESEARCH line 409). Add `Keyboard` listener to hide FAB on keyboard (SHELL-06, Pitfall 5; MEMORY: prefer `onSubmitEditing` over `KeyboardAvoidingView`).

---

### `src/components/ContactPicker.tsx` (new modal picker) — SHELL-09/10

**Analog A — list/filter/search body:** `LegacyContactPickerScreen.tsx:48-265`:
```tsx
// LegacyContactPickerScreen.tsx (verbatim structure to copy):
const [query, setQuery] = useState("");                          // :57
const filteredRows = useMemo(() => filterRows(rows, query), [rows, query]); // :141
// <TextInput ... /> search (:236) → <FlatList data={filteredRows}
//   keyExtractor={(row) => row.lookupKey} renderItem={...} /> (:258-265)
```
**Analog B — Modal sheet surface + a11y + scrim dismiss:** `OverflowMenu.tsx:44-60` — `Modal transparent animationType="fade"`, `onRequestClose`, `StyleSheet.absoluteFill` Pressable scrim over `surfaceElevated` sheet, `accessibilityLabel="Dismiss actions"`. Reuse for the "compact modal/bottom-sheet" surface (RESEARCH §Don't Hand-Roll — prefer built-in `Modal`, do NOT add `@gorhom/bottom-sheet`). Set `accessibilityViewIsModal` on the open sheet (SHELL-14, Pitfall 7). Data comes from `contact-picker-order.ts` (above).

---

### `src/components/Snackbar.tsx` (new) — SHELL-11 commit-truthful Quick Log

**Analog (closest transient-confirmation surface; NO true snackbar/toast component exists):** `CaptureScreen.tsx:851-878` — the `capture-confirmation-toast` surface (themed `surface`/`border`/`textPrimary`, conditional render, `setState+setTimeout` auto-dismiss). Note CaptureScreen's toast is `setState`-driven, not animated (`CaptureScreen.tsx:238` comment "never a per-frame animation") — acceptable for a transient surface; a Reanimated slide-in is optional but if used, follow the FAB shared-value idiom, never per-frame setState.

**Commit-truth wiring (do NOT show success optimistically — Anti-Pattern):** key the snackbar off the resolved promise of `recordTouchpoint` (`recency-dao.ts:217-243`), which runs inside `inWriteTransaction`, recomputes `last_contact`, bumps data revision, and **rejects a future `occurred_at` before any transaction opens** (`recency-dao.ts:221-231`):
```ts
// recency-dao.ts:232-242 (verbatim) — success signal is the resolved {interactionId}:
return inWriteTransaction(exec, async () => {
  const interactionId = await insertInteraction(exec, input.contactId, input.now, input);
  await recomputeLastContact(exec, input.contactId, input.now);
  await bumpDataRevisionCore(exec);
  return { interactionId };
});
```
Show success (`+ Undo` + success haptic) only in `.then(({interactionId})=>…)`; error (`+ Retry`) only in `.catch(…)` (RESEARCH lines 360-372). **Undo needs a NEW guarded delete-interaction DAO export — none exists** (Assumption A5, `recency-dao.ts` has only `recordTouchpoint`/`editTouchpointFull`); mirror `recordTouchpoint`'s `inWriteTransaction` + `recomputeLastContact` structure. Flag as a plan task; extend `recency-dao.test.ts`.

---

### External-reset call sites — flat → nested shape (SHELL-05, D-07/D-08)

**Analog / current shape (verbatim, `widget-linking.ts:275-278`):**
```ts
navigationRef.current?.reset({ index: 0, routes: [{ name: "Home" }] });
```
**New (from `src/navigation/reset-intents.ts`, pure — RESEARCH Pattern 3, lines 239-247):**
```ts
export function resetToDashboardRoot() {
  return { index: 0, routes: [{ name: "DashboardTab" as const,
    state: { index: 0, routes: [{ name: "Home" as const }] } }] };
}
export function resetToDashboardWith(target: { name: string; params?: object }) {
  return { index: 0, routes: [{ name: "DashboardTab" as const,
    state: { index: 1, routes: [{ name: "Home" as const }, target] } }] };
}
```
`reset-intents.ts` is the **single owner** (pure, node-testable — same idiom as `add-speed-dial-fab-logic.ts`); every external path calls it. The `notification-gate.tsx:136` (`nav.reset({index:intent.index,routes:intent.routes})`) and `widget-linking.ts:287` sites map their flat intents through it. **Do NOT weaken the deep-link acceptance logic** — only the emitted shape changes (Security §V5; `widget-linking.ts:103-119` id guards untouched).

**Full D-08 call-site inventory** (re-verify against disk at plan time — quoted verbatim in RESEARCH lines 288-312):

| Class | Site | Post-refactor |
|-------|------|---------------|
| A (external, MUST survive — ADR-044) | `ComposeScreen.tsx:267`, `notification-gate.tsx:136`, `widget-linking.ts:287`, `widget-linking.ts:274` | route through `resetToDashboardRoot()` / `resetToDashboardWith()` |
| B (Backup-tab-local) | `RestorePreviewScreen.tsx:99`, `:123`, `RestoreResultScreen.tsx:18` | stays flat IF `Backup` is that stack's root route name — confirm |
| C (import/reconcile → Dashboard, origin-ambiguous) | `ImportCompleteScreen.tsx:300`, `ReconcileCompleteScreen.tsx:47` | `resetToDashboardRoot()` (Open Q2 recommendation) |

---

## Shared Patterns

### Theme tokens (all chrome)
**Source:** `useTheme()` in every analog (`AddSpeedDialFab.tsx:23`, `OverflowMenu.tsx:30`, `CaptureScreen` toast).
**Apply to:** UniversalFab, ContactPicker, Snackbar, tab bar. No colour literal anywhere including Skia (CLAUDE.md / `check:colors`).

### Pure-resolver + node-test idiom (the codebase's testability contract)
**Source:** `add-speed-dial-fab-logic.ts` (+ `.test.ts`), `capture-read.ts` (+ `capture-read.test.ts`), `widget-linking.ts` resolvers.
**Apply to:** `reset-intents.ts`, `back-intent.ts`, `contact-picker-order.ts`, `universal-fab-logic.ts`. vitest env is **node/render-free** (RESEARCH lines 461-466) — navigator wiring is UAT-verified on the Pixel, not vitest.

### `headerShown:false` / screens own chrome
**Source:** `RootNavigator.tsx:75`.
**Apply to:** the new `Tab.Navigator` and every per-tab stack (SHELL-13).

### Modal + scrim + a11y-modal
**Source:** `OverflowMenu.tsx:44-60`.
**Apply to:** ContactPicker, speed-dial overlay (SHELL-14: `accessibilityViewIsModal`, focus restore to invoking FAB).

### `beforeRemove` Discard/Keep guard (SHELL-07)
**Source:** `RestorePreviewScreen.tsx:94-96` (already `preventDefault()`s Back while applying).
**Apply to:** any focused workflow with unsaved edits + the back-intent resolver.

---

## No Analog Found

None. Every new file maps to an on-disk analog. The two weakest matches (documented above, not blockers):

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `src/components/Snackbar.tsx` | component | event-driven | No true snackbar/toast component exists; closest is `CaptureScreen.tsx:851` confirmation surface (setState-driven). Undo/Retry affordance + the delete-interaction DAO are net-new. |
| `src/navigation/tabs/*Stack.tsx` | navigation | event-driven | `@react-navigation/bottom-tabs@^7.18.18` not yet installed (only new dependency); per-tab stack bodies are exact copies of the current `RootNavigator` stack block. |

## Metadata

**Analog search scope:** `src/navigation/`, `src/components/`, `src/screens/`, `src/db/`, `src/logic/`
**Files read verbatim this session:** `RootNavigator.tsx`, `types.ts`, `AddSpeedDialFab.tsx`, `add-speed-dial-fab-logic.ts`, `recency-dao.ts` (170-249), `capture-read.ts`, `OverflowMenu.tsx`, `widget-linking.ts` (255-295), `notification-gate.tsx` (128-140), `CaptureScreen.tsx` (840-895), `LegacyContactPickerScreen.tsx` (structure)
**Pattern extraction date:** 2026-09-02
</content>
</invoke>
