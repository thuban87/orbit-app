# UX Standards

**Last updated:** 2026-10-11
**Updated by phase:** 38.9
**Owners:** `src/stores/confirm-store.ts`, `src/components/ui/DialogHost.tsx`, `src/stores/overlay-registry-store.ts`, `src/components/ui/RegisteredModal.tsx`, `src/navigation/discard-keep-guard.ts`, `src/components/ShellAppBar.tsx`, `src/navigation/tab-history.ts`, `src/stores/snackbar-store.ts`, `src/components/ui/` (OrbitSwitch, OptionSheet, FieldError, EmptyState, chip-tone), `src/utils/dates.ts`, `src/utils/plural.ts`

## Purpose

These are the app-wide interaction rules every screen follows: how destructive actions are
confirmed or undone, how writes give feedback, how dialogs, sheets, headers, Back and forms
behave, and how dates, counts and empty states read. Phase 38.9 wrote the rules and built the
shared pieces; area phases (38.10 to 38.15, 39) apply them to their own screens instead of
inventing their own (D-01). Each rule below cites the decision it comes from
(`.planning/phases/38.9-ux-standards/38.9-CONTEXT.md`, D-NN) or an ADR. A rule with no
citation here is not a standard.

## Architecture

### Data Model

This system owns no table and stores nothing. Every rule is presentation or navigation
behaviour; no schema, migration or backup-format change came with it (D-12).

### Key Files

| File | Role |
|------|------|
| `src/stores/confirm-store.ts` | `confirm()` / `notice()` Promise API and the dialog queue (D-24). |
| `src/components/ui/DialogHost.tsx` | The one themed dialog host, mounted once in `App.tsx` (D-24). |
| `src/components/ui/ConfirmDialog.tsx` | The themed confirm / destructive confirm / notice card (D-06, D-43). |
| `src/stores/overlay-registry-store.ts` | `registerOverlay` / `unregisterOverlay` / `selectAnyOverlayOpen`: the "a dialog or sheet is open" signal (D-24). |
| `src/components/ui/RegisteredModal.tsx` | The only RN `Modal` wrapper; registers while visible and hosts an in-window snackbar (D-24, D-40). |
| `src/navigation/discard-keep-guard.ts` | `useDiscardKeepGuard`, `confirmDiscard`, `decideGuardOnRemove`: the unsaved-work guard (D-13, D-14). |
| `src/components/ShellAppBar.tsx`, `src/components/PersonLine.tsx`, `src/hooks/use-contact-header.ts` | The house header, chevron Back and person line (D-16, D-44, D-45). |
| `src/navigation/tab-history.ts` | History Back across tabs and `switchTabWithoutHistory` (D-35, D-54). |
| `src/stores/snackbar-store.ts`, `src/components/Snackbar.tsx` | `showSnackbar`, 6000 ms auto-dismiss (D-04). |
| `src/components/ui/OrbitSwitch.tsx`, `orbit-switch-logic.ts` | The one switch (D-25, D-26, D-47). |
| `src/components/ui/chip-tone.ts` | `chipTone(tier, selected)` for the two chip tiers (D-05). |
| `src/components/ui/OptionSheet.tsx`, `OptionSelectRow.tsx` | The one single-choice sheet and its trigger row (D-28). |
| `src/components/ui/FieldError.tsx`, `use-first-error-reveal.ts`, `field-error-logic.ts` | Inline validation and scroll to the first error (D-19). |
| `src/components/ui/EmptyState.tsx`, `empty-state-logic.ts` | The one empty-state component (D-20, D-71). |
| `src/utils/dates.ts` | `formatDisplayDate`, `formatDisplayDateOrFallback`, `formatStoredBirthdayForDisplay` (D-23, D-48, D-70). |
| `src/components/date-pick-logic.ts` | Native date-picker storage rules (D-65 to D-67). |
| `src/utils/plural.ts` | `plural(n, one, many?)` / `pluralWord(n, one, many?)` (D-21). |

## Destructive actions

The rule (D-30):

1. A **reversible** action happens at once and shows a snackbar with **Undo**.
2. An **irreversible** action asks first with the themed **destructive confirm**: warning glyph
   above the title, destructive button, and it cannot be dismissed by Back or the scrim, only by
   its buttons (D-06, ADR-086).
3. A destructive button is **never the loudest control at rest** on its screen.
4. On list cards, destructive actions sit behind the **⋯** menu.

Carve-outs that hold (D-09): Purge keeps its impact-summary confirm; deleting an interaction stays
a hard delete with explicit confirmation (there is no interaction Trash); Unbind stays confirmed.

Under the rule, **Archive, Restore and Bind act at once** with a snackbar naming the person and
Undo; **Unbind keeps its confirm** (D-32). 38.11 and 38.12 wire this on their screens.

Holding zones are what make an action reversible today; no new recoverable-delete storage exists
(D-31): Archived contacts; memories in Recently Deleted for 30 days (ADR-089); key people
soft-deleted for snackbar Undo only; custom fields with values in Quarantine for 30 days.
Deleting an interaction, Off Limits item, photo, System or background template is permanent and
therefore confirmed.

## Feedback

The rule (D-39): every write that is silent today shows a snackbar naming the person (and the
channel, for logs). Undo is offered where the action is reversible. Tapping Undo shows its own
confirming snackbar. Areas apply this to their own writes.

Snackbar copy (D-46): verb first, then whom.

- "Logged Message with Ann", "Archived Ann Lee".
- The Undo confirmation names what was undone, e.g. "Log removed".
- Counts go through the plural helper: "Archived 1 contact", "Archived 3 contacts" (D-21).

Behaviour:

- Every snackbar auto-dismisses after **6000 ms** (D-04).
- A snackbar fired from inside an open sheet or dialog renders **above** that overlay, so nothing
  fired from an overlay is hidden (D-40). It sits at the bottom of the screen above the system
  navigation bar, without the tab-bar and + clearance the root snackbar keeps, and may briefly
  cover a sheet's bottom buttons (D-51). `RegisteredModal` provides the in-window host.
- Validation errors inside a sheet render inline under the field, not as a snackbar (D-40, D-19).

**Snackbar or notice** (D-27): an error or info message where the user can carry on is an error
snackbar; one where the user is blocked is a themed one-button **notice**. Every decision is a
themed confirm. No production `Alert.alert` remains except the snooze Alert in `HomeScreen.tsx`,
which 38.11 owns (D-10, D-27); `src/no-native-alert-contract.test.ts` enforces this.

## Dialogs

- Call themed dialogs imperatively: `await confirm({ title, message, confirmLabel, destructive })`
  resolves `true` / `false`; `await notice({ title, message })` resolves when acknowledged. One
  `DialogHost` serves the whole app. The declarative `ConfirmDialog` stays for its existing
  consumers (D-24).
- Layout: one action row when both labels fit, otherwise stacked full-width with Cancel first
  (D-06, ADR-174).
- Look: the elevated card with a 2dp `borderStrong` border, matching Phase 39's lesson cards
  (D-43).
- The **"Discard changes?"** prompt has no warning glyph above the title; the ⚠ sits on the
  **Discard changes** button only. Other destructive confirms keep the glyph above the title
  (D-52).
- **"A dialog or sheet is open"** is read from the overlay registry (`selectAnyOverlayOpen`),
  never from the shell dismiss stack. Back and tab re-tap `dismissTop()` can therefore never
  close a non-dismissable destructive confirm (D-24). Any new raw `Modal` goes through
  `RegisteredModal` so it registers.
- Native date and time pickers stay native; there is no themed picker (D-29).

## Unsaved work

- Every form with meaningful unsaved changes gets the guard. An untouched form leaves at once.
  The prompt is the themed "Discard changes?" with **Keep editing** / **Discard changes** (D-13).
- Back (header, system, gesture) first closes the innermost sheet or in-screen sub-editor, and
  prompts only if typed text would be lost. The guard has route, in-screen sub-editor and
  overlay variants of this one rule (D-14).
- A form is dirty only against its **seed** values, so a freshly opened form, including one with
  defaults filled in, is never dirty. A save sets the bypass before it navigates away (D-15).
- An editor's own **Cancel** follows the same rule as Back: with typed changes it prompts;
  untouched, it closes at once; a successful save closes without a prompt (D-61).
- Folding a section that holds a typed, not-yet-added draft prompts first; an untouched draft
  folds at once (D-68).
- Capture: Back first closes an open New-contact sheet, and with a typed note shows the prompt
  instead of discarding (D-33). Backup schedule day counts save when the field is left; AI
  Writing Style keeps its Save button with the guard and a "Saved" snackbar (D-34).

## Headers and Back

- Every pushed screen uses the house header, `ShellAppBar variant="child"`. Tab roots keep
  `variant="root"`; the Profile keeps its own top bar (D-16, ADR-109, ADR-175).
- The header's Back is an **icon-only chevron** with the accessible label "Back" and a 44dp
  target (D-44). Confirm-or-abandon screens use an icon-only ✕ labelled "Cancel"
  (`backKind="cancel"`) and have that one exit (D-59).
- A screen has exactly **one Back**, the header's (D-07, ADR-175).
  `src/screens/settings-chrome-contract.test.ts` changes in the same commit as any header change.
- Person-scoped forms keep a fixed title and show the person's avatar and name under it
  (`person` prop, `PersonLine`), with clear space between title and name (D-45). Edit Contact
  shows the title only (D-64).
- Pushed screens show the theme art; no opaque `colors.background` screen fill (D-17).
- Tabs use history Back: Back on a tab root returns to the previously visited tab. When history
  is exhausted on a non-launch tab, Back goes to Digest first, so the app always exits from
  Digest (D-35, D-54).
- Programmatic tab switches that must not enter Back history (Phase 39 Orient hops) use
  `switchTabWithoutHistory` (D-35).
- The **+** forms open over the tab the user is on; Back before saving returns there; completion
  destinations are unchanged (D-38, D-08). Add Contact started from Settings finishes on the new
  Profile in the Contacts tab (D-50).
- The + stays visible on browse surfaces, including ordinary Settings child pages (D-11). Its
  standard for not covering content is the **end-of-scroll bottom clearance**
  (`useBottomClearance`, ADR-173); mid-scroll overlap is accepted (D-36, D-55). The + does not
  change while a Contacts control panel is open (D-37).
- Focused workflows (e.g. Compose, Research) hide the tab bar and + (D-18).

## States

- **Chips** (D-05): top-level choices selected = solid accent fill with an `onAccent` label;
  sub-options selected = accent outline with `accentText`. Use `chipTone("primary" | "sub",
  selected)`.
- **Switches** (D-25, D-47): every switch is `OrbitSwitch`. Off = outlined `borderStrong` track
  with a small `textSecondary` thumb; on = `accent` track with a large `onAccent` thumb and a
  check. New colour tokens get values in every package and mode and pass `check:colors` and
  `src/theme/contrast.test.ts` (D-25). The off outline contrast stays as chosen (D-62).
  `src/components/ui/orbit-switch-contract.test.ts` rejects any RN `Switch`.
- **Disabled** controls are dimmed; a disabled switch shows Off (D-26).

## Option sheet

Every single choice uses the one themed `OptionSheet` (trigger: `OptionSelectRow`), at every list
length; search appears on long lists. No `@react-native-picker/picker` import remains (D-28);
`src/components/ui/no-native-picker-contract.test.ts` enforces this.

## Validation

One inline-validation primitive (D-19): error text under the field (`FieldError`), cleared when
the field changes; on Save, scroll and focus to the first blocking problem
(`useFirstErrorReveal`). Save stays pressable.

## Empty state

One `EmptyState` component (D-20): an icon, a heading saying what is empty, one help line, one
action. A search-term echo is truncated. Action labels (D-71): a search that found nothing →
"Clear search"; Events with none logged yet → "Log an event"; Events failed to load →
"Try again"; History keeps "Log interaction".

## Dates

- One date-only display formatter in `src/utils/dates.ts` (D-23). It reads "Oct 13" in the current
  year and "Jun 2, 2025" otherwise; the weekday is added where the day matters ("Tue, Oct 13");
  time only where it matters (D-48). History's day labels include the comma ("Fri, Oct 2",
  "Nothing logged on Tue, Oct 5"; D-53, D-57).
- A birthday with a known year always shows its year ("Jun 2, 2026"); a year-unknown birthday
  shows month-day ("Jun 2") (D-70). Use `formatStoredBirthdayForDisplay`.
- Display formatters are **display only**. Storage keys, query parameters and stored values use
  `formatLocalDate()` (D-23; CLAUDE.md conventions). Where a stored value may not parse, use
  `formatDisplayDateOrFallback(value, value)` so the raw value stays visible.
- Date pickers (D-65, D-66, D-67): a Memory's meaningful date and the custom-field Date widget
  use the native picker, store `YYYY-MM-DD` via `formatLocalDate()`, and set no date range. The
  wording is "Pick a date" (empty), "Clear" (button) and "Not a date" (a stored value that fails
  the date parser). A memory date is always a full date. Custom-field values stay raw TEXT and
  are never rewritten (ADR-001).
- `src/utils/display-date-contract.test.ts` enforces the display-only rule.

## Counts and wording

- Every user-visible count goes through `plural(n, one, many?)` so one item reads singular
  ("1 contact"). Use `pluralWord` when the number sits elsewhere in the sentence (D-21).
- Canonical terms, retired forms and plain-word rules live in [glossary.md](glossary.md)
  (D-22, D-41, D-42, D-49).

## Configuration

| Constant | Value | File | Purpose |
|----------|-------|------|---------|
| snackbar auto-dismiss | `6000` ms | `src/stores/snackbar-store.ts` | One duration for every snackbar (D-04). |
| `SEARCH_ECHO_MAX_CHARS` | `40` | `src/components/ui/empty-state-logic.ts` | Empty-state search echo truncation (D-20). |
| `CATEGORY_SEARCH_THRESHOLD` | `12` | `src/logic/category-logic.ts` | Option-sheet search appears above this many choices (D-28). |

## Decisions

- **ADR-086:** semantic icons and accessible primitives: destructive confirms are not dismissable.
- **ADR-174:** dialog and sheet action layout at large text.
- **ADR-175:** header-only Back and the shared header.
- **ADR-173:** + visibility and end-of-scroll bottom clearance.
- **ADR-109:** the Profile keeps its own top bar.
- **ADR-089:** Recently Deleted holds memories for 30 days.
- **ADR-001:** custom-field values stay raw TEXT; format only at render.

## Gotchas

1. **The overlay registry is not the shell dismiss stack.** Back and tab re-tap close shell
   transients through `dismissTop()`, which never sees the dialog host or registered sheets.
   Reading "is a dialog open" from anything but `selectAnyOverlayOpen` misses confirms, and
   wiring the host into `dismissTop()` would let Back close a destructive confirm (D-24).
2. **A display date is never a key.** Writing `formatDisplayDate` output to a stored value,
   `testID` or key fails the display-date contract (D-23).
3. **Undo is per area.** The rules say which actions get Undo; only the area phase that owns a
   screen wires it (D-01, D-10). Do not add Undo to another area's screen in passing.
4. **Header conversions move contract lists.** Changing a screen's header without updating
   `settings-chrome-contract.test.ts` breaks the single-Back contract (D-07).

## Related Systems

- **App shell** ([app-shell.md](app-shell.md)): navigation tree, + hosting and tab stacks that
  these rules run on.
- **Glossary** ([glossary.md](glossary.md)): the words the rules use.
- **Custom fields** ([custom-fields.md](custom-fields.md)): the Date widget and raw-TEXT values.

## Changelog

| Date | Phase | What Changed |
|------|-------|--------------|
| 2026-10-11 | 38.9 | Created: destructive-action rule (D-30, D-32), feedback rule (D-39) and snackbar copy (D-46), themed dialogs and the overlay registry (D-24, D-27), unsaved-work guard (D-13, D-14, D-61, D-68), header and Back (D-16, D-44, D-45, D-35, D-54, D-38), states (D-05, D-47, D-26), option sheet (D-28), validation (D-19), empty state (D-20, D-71), dates (D-23, D-48, D-65 to D-67, D-70), plural helper (D-21). |
